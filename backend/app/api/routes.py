from fastapi import APIRouter,Depends,HTTPException,UploadFile,File,Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime
import pandas as pd
from ..database import get_db
from ..models import User,Supplier,Product,ProductSupplier,Purchase,Sale,SaleItem,Contact,Category,SubCategory,CostHistory
from ..schemas import *
from ..security import hash_password,verify_password,create_token,user_id_from_token
router=APIRouter(prefix='/api')

def current_user(authorization:str|None=Header(default=None), db:Session=Depends(get_db)):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'No autenticado')
    uid=user_id_from_token(authorization.replace('Bearer ','')); u=db.query(User).filter(User.id==uid).first() if uid else None
    if not u: raise HTTPException(401,'Token invalido')
    return u

def admin_only(u:User=Depends(current_user)):
    if u.role!='Admin': raise HTTPException(403,'Solo Admin')
    return u

def clean(v,default=''):
    try:
        if pd.isna(v): return default
    except Exception: pass
    return str(v).strip()

def num(v,default=0):
    try:
        if pd.isna(v) or v=='': return default
        return float(v)
    except Exception: return default

def norm_col_name(v):
    return str(v).strip().upper().replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U').replace('Ñ','N').replace('/',' ').replace('-',' ').replace('.', ' ').replace('__','_')

def colmap(df):
    out={}
    for c in df.columns:
        n=norm_col_name(c)
        out[n]=c
        out[n.replace(' ','_')]=c
        out[n.replace(' ','')]=c
    return out

def first_col(cm,*names):
    for name in names:
        key=norm_col_name(name)
        variants=[key,key.replace(' ','_'),key.replace(' ','')]
        for v in variants:
            if v in cm: return cm[v]
    return None

def row_has_col(cm,*names):
    return first_col(cm,*names) is not None

def row_value(row,cm,names,default=''):
    col=first_col(cm,*names)
    if col is None: return default
    return clean(row[col],default)

def row_num(row,cm,names,default=0):
    col=first_col(cm,*names)
    if col is None: return default
    return num(row[col],default)


def ensure_category(db:Session, category_name:str, subcategory_name:str='General'):
    category_name=(category_name or 'General').strip() or 'General'
    subcategory_name=(subcategory_name or 'General').strip() or 'General'
    cat=db.query(Category).filter(func.lower(Category.name)==category_name.lower()).first()
    if not cat:
        cat=Category(name=category_name); db.add(cat); db.flush()
    sub=db.query(SubCategory).filter(SubCategory.category_id==cat.id, func.lower(SubCategory.name)==subcategory_name.lower()).first()
    if not sub:
        db.add(SubCategory(category_id=cat.id,name=subcategory_name)); db.flush()
    return category_name, subcategory_name


def product_payload(p):
    suppliers=[]; best=None
    for ps in p.suppliers:
        it={'supplier_id':ps.supplier_id,'supplier_name':ps.supplier.name,'supplier_sku':ps.supplier_sku,'supplier_price':ps.supplier_price,'supplier_stock':ps.supplier_stock,'coefficient':ps.supplier.freight_coefficient,'calculated_cost':ps.calculated_cost,'updated_at':ps.updated_at}
        suppliers.append(it); best=it if best is None or it['calculated_cost']<best['calculated_cost'] else best
    return {'id':p.id,'sku':p.sku,'name':p.name,'description':p.description,'category':p.category,'subcategory':p.subcategory,'brand':p.brand,'compatibility':p.compatibility,'stock':p.stock,'reserved_stock':p.reserved_stock,'available_stock':(p.stock or 0)-(p.reserved_stock or 0),'min_stock':p.min_stock,'cost':p.cost,'margin':p.margin,'sale_price':p.sale_price,'active':p.active,'suppliers':suppliers,'best_supplier':best}

@router.post('/auth/login')
def login(p:LoginIn,db:Session=Depends(get_db)):
    u=db.query(User).filter(User.username==p.username).first()
    if not u or not verify_password(p.password,u.password_hash): raise HTTPException(401,'Usuario o clave incorrecta')
    return {'token':create_token(u.id),'user':{'id':u.id,'username':u.username,'role':u.role}}

@router.get('/dashboard')
def dash(db:Session=Depends(get_db),u:User=Depends(current_user)):
    products=db.query(Product).all()
    sales_rows=db.query(Sale).order_by(Sale.created_at.desc()).limit(8).all()
    purchase_rows=db.query(Purchase).order_by(Purchase.created_at.desc()).limit(6).all()
    low_stock_products=[{
        'id':p.id,'sku':p.sku,'name':p.name,'stock':p.stock or 0,'min_stock':p.min_stock or 0,
        'available_stock':(p.stock or 0)-(p.reserved_stock or 0),'sale_price':p.sale_price or 0
    } for p in sorted([p for p in products if (p.stock or 0) <= (p.min_stock or 0)], key=lambda x: ((x.stock or 0)-(x.min_stock or 0), x.sku))[:10]]
    top_rows=db.query(
        SaleItem.product_id,
        func.sum(SaleItem.quantity).label('qty'),
        func.sum(SaleItem.total).label('amount')
    ).join(Sale, Sale.id==SaleItem.sale_id).filter(Sale.type=='Pedido de venta').group_by(SaleItem.product_id).order_by(func.sum(SaleItem.quantity).desc()).limit(8).all()
    top_selling=[]
    for product_id,qty,amount in top_rows:
        p=db.query(Product).filter(Product.id==product_id).first()
        if p:
            top_selling.append({'id':p.id,'sku':p.sku,'name':p.name,'quantity':qty or 0,'amount':amount or 0,'stock':p.stock or 0})
    recent_sales=[{'id':x.id,'type':x.type,'status':x.status,'customer_name':x.customer_name,'total':x.total or 0,'created_at':x.created_at} for x in sales_rows]
    recent_purchases=[]
    for x in purchase_rows:
        supplier=db.query(Supplier).filter(Supplier.id==x.supplier_id).first()
        product=db.query(Product).filter(Product.id==x.product_id).first()
        recent_purchases.append({'id':x.id,'supplier_name':supplier.name if supplier else '', 'sku':product.sku if product else '', 'product_name':product.name if product else '', 'quantity':x.quantity or 0, 'total':x.total or 0, 'created_at':x.created_at})
    sales_total=sum((x.total or 0) for x in db.query(Sale).filter(Sale.type=='Pedido de venta').all())
    quote_total=sum((x.total or 0) for x in db.query(Sale).filter(Sale.type=='Presupuesto').all())
    stock_value=sum((p.stock or 0)*(p.cost or 0) for p in products)
    potential_sale_value=sum((p.stock or 0)*(p.sale_price or 0) for p in products)
    return {
        'products':len(products),
        'contacts':db.query(Contact).count(),
        'suppliers':db.query(Supplier).count(),
        'sales':db.query(Sale).filter(Sale.type=='Pedido de venta').count(),
        'quotes':db.query(Sale).filter(Sale.type=='Presupuesto').count(),
        'purchases':db.query(Purchase).count(),
        'low_stock':len(low_stock_products),
        'stock_value':stock_value,
        'potential_sale_value':potential_sale_value,
        'sales_total':sales_total,
        'quote_total':quote_total,
        'low_stock_products':low_stock_products,
        'top_selling':top_selling,
        'recent_sales':recent_sales,
        'recent_purchases':recent_purchases
    }

@router.get('/users')
def users(db:Session=Depends(get_db),u:User=Depends(admin_only)): return db.query(User).all()
@router.post('/users')
def create_user(p:UserIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    if db.query(User).filter(User.username==p.username).first(): raise HTTPException(400,'Usuario existente')
    x=User(username=p.username,password_hash=hash_password(p.password),role=p.role); db.add(x); db.commit(); db.refresh(x); return x

@router.get('/categories')
def categories(db:Session=Depends(get_db),u:User=Depends(current_user)):
    return [{'id':c.id,'name':c.name,'subcategories':[{'id':s.id,'name':s.name} for s in c.subcategories if s.active]} for c in db.query(Category).filter(Category.active==1).all()]
@router.post('/categories')
def create_category(p:CategoryIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    x=db.query(Category).filter(Category.name==p.name).first()
    if x: return x
    x=Category(name=p.name); db.add(x); db.commit(); db.refresh(x); return x
@router.post('/subcategories')
def create_subcategory(p:SubCategoryIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    x=SubCategory(category_id=p.category_id,name=p.name); db.add(x); db.commit(); db.refresh(x); return x

@router.get('/suppliers')
def suppliers(q:str='',db:Session=Depends(get_db),u:User=Depends(current_user)):
    qry=db.query(Supplier)
    if q: qry=qry.filter(or_(Supplier.name.ilike(f'%{q}%'),Supplier.business_name.ilike(f'%{q}%'),Supplier.cuit.ilike(f'%{q}%')))
    return qry.order_by(Supplier.name).all()
@router.post('/suppliers')
def create_supplier(p:SupplierIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    x=Supplier(**p.model_dump(),updated_at=datetime.utcnow()); db.add(x); db.commit(); db.refresh(x); return x
@router.put('/suppliers/{id}')
def update_supplier(id:int,p:SupplierIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    x=db.query(Supplier).filter(Supplier.id==id).first()
    if not x: raise HTTPException(404,'Proveedor no encontrado')
    for k,v in p.model_dump().items(): setattr(x,k,v)
    x.updated_at=datetime.utcnow(); db.commit(); db.refresh(x); return x
@router.delete('/suppliers/{id}')
def delete_supplier(id:int,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    x=db.query(Supplier).filter(Supplier.id==id).first()
    if not x: raise HTTPException(404,'Proveedor no encontrado')
    x.active=0; db.commit(); return {'ok':True}

@router.get('/contacts')
def contacts(q:str='',db:Session=Depends(get_db),u:User=Depends(current_user)):
    qry=db.query(Contact)
    if q: qry=qry.filter(or_(Contact.name.ilike(f'%{q}%'),Contact.phone.ilike(f'%{q}%'),Contact.document.ilike(f'%{q}%'),Contact.email.ilike(f'%{q}%')))
    return qry.order_by(Contact.name).all()
@router.post('/contacts')
def create_contact(p:ContactIn,db:Session=Depends(get_db),u:User=Depends(current_user)):
    x=Contact(**p.model_dump()); db.add(x); db.commit(); db.refresh(x); return x
@router.put('/contacts/{id}')
def update_contact(id:int,p:ContactIn,db:Session=Depends(get_db),u:User=Depends(current_user)):
    x=db.query(Contact).filter(Contact.id==id).first()
    if not x: raise HTTPException(404,'Contacto no encontrado')
    for k,v in p.model_dump().items(): setattr(x,k,v)
    db.commit(); db.refresh(x); return x

@router.get('/products')
def products(q:str='',db:Session=Depends(get_db),u:User=Depends(current_user)):
    qry=db.query(Product)
    if q: qry=qry.filter(or_(Product.sku.ilike(f'%{q}%'),Product.name.ilike(f'%{q}%'),Product.category.ilike(f'%{q}%'),Product.subcategory.ilike(f'%{q}%'),Product.brand.ilike(f'%{q}%')))
    return [product_payload(p) for p in qry.order_by(Product.sku).all()]

@router.get('/products/{id}')
def get_product(id:int,db:Session=Depends(get_db),u:User=Depends(current_user)):
    x=db.query(Product).filter(Product.id==id).first()
    if not x: raise HTTPException(404,'Producto no encontrado')
    return product_payload(x)

@router.post('/products')
def create_product(p:ProductIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    if db.query(Product).filter(Product.sku==p.sku).first(): raise HTTPException(400,'SKU propio existente')
    x=Product(**p.model_dump()); db.add(x); db.commit(); db.refresh(x); return product_payload(x)
@router.put('/products/{id}')
def update_product(id:int,p:ProductIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    x=db.query(Product).filter(Product.id==id).first()
    if not x: raise HTTPException(404,'Producto no encontrado')
    for k,v in p.model_dump().items(): setattr(x,k,v)
    x.updated_at=datetime.utcnow(); db.commit(); db.refresh(x); return product_payload(x)


@router.post('/products/import')
async def import_products(file:UploadFile=File(...),db:Session=Depends(get_db),u:User=Depends(admin_only)):
    df=pd.read_excel(file.file); cm=colmap(df)
    sku_col=first_col(cm,'SKU','SKU PROPIO','CODIGO','CODIGO PROPIO')
    if not sku_col: raise HTTPException(400,'Falta columna obligatoria: SKU')
    created=updated=skipped=0; errors=[]; touched=[]
    for idx,r in df.iterrows():
        sku=clean(r[sku_col])
        if not sku:
            skipped+=1; errors.append({'row':int(idx)+2,'error':'SKU vacío'}); continue
        p=db.query(Product).filter(Product.sku==sku).first()
        name=row_value(r,cm,('DESCRIPCION','DESCRIPCIÓN','PRODUCTO','NOMBRE','DETALLE'),p.name if p else '')
        if not p and not name:
            skipped+=1; errors.append({'row':int(idx)+2,'sku':sku,'error':'Producto nuevo sin DESCRIPCION/NOMBRE'}); continue
        data={}
        if name: data['name']=name; data['description']=row_value(r,cm,('DESCRIPCION_LARGA','DESCRIPCION LARGA','DESCRIPCIÓN LARGA'),name)
        if row_has_col(cm,'MARCA'): data['brand']=row_value(r,cm,('MARCA',),p.brand if p else '')
        if row_has_col(cm,'CATEGORIA','CATEGORÍA') or row_has_col(cm,'SUBCATEGORIA','SUB CATEGORIA','SUBCATEGORÍA','SUB CATEGORÍA'):
            category=row_value(r,cm,('CATEGORIA','CATEGORÍA'),p.category if p else 'General')
            subcategory=row_value(r,cm,('SUBCATEGORIA','SUB CATEGORIA','SUBCATEGORÍA','SUB CATEGORÍA'),p.subcategory if p else 'General')
            category,subcategory=ensure_category(db,category,subcategory)
            data['category']=category; data['subcategory']=subcategory
        if row_has_col(cm,'COMPATIBILIDAD','COMPATIBILIDADES'): data['compatibility']=row_value(r,cm,('COMPATIBILIDAD','COMPATIBILIDADES'),p.compatibility if p else '')
        if row_has_col(cm,'STOCK_MINIMO','STOCK MINIMO','STOCK MÍNIMO','MINIMO','MÍNIMO'): data['min_stock']=row_num(r,cm,('STOCK_MINIMO','STOCK MINIMO','STOCK MÍNIMO','MINIMO','MÍNIMO'),p.min_stock if p else 0)
        if row_has_col(cm,'MARGEN','% MARGEN'): data['margin']=row_num(r,cm,('MARGEN','% MARGEN'),p.margin if p else 0)
        if row_has_col(cm,'PRECIO_VENTA','PRECIO VENTA','PRECIO','VENTA','P VENTA','PV','PRECIO PUBLICO','PRECIO PÚBLICO'): data['sale_price']=row_num(r,cm,('PRECIO_VENTA','PRECIO VENTA','PRECIO','VENTA','P VENTA','PV','PRECIO PUBLICO','PRECIO PÚBLICO'),p.sale_price if p else 0)
        if row_has_col(cm,'COSTO','COSTO PROVEEDOR','COSTO_COMPRA','COSTO COMPRA'): data['cost']=row_num(r,cm,('COSTO','COSTO PROVEEDOR','COSTO_COMPRA','COSTO COMPRA'),p.cost if p else 0)
        if row_has_col(cm,'STOCK','STOCK ACTUAL','CANTIDAD'): data['stock']=row_num(r,cm,('STOCK','STOCK ACTUAL','CANTIDAD'),p.stock if p else 0)
        if p:
            for k,v in data.items(): setattr(p,k,v)
            p.updated_at=datetime.utcnow(); updated+=1; touched.append({'sku':sku,'action':'actualizado','fields':list(data.keys())})
        else:
            category=data.get('category','General'); subcategory=data.get('subcategory','General'); category,subcategory=ensure_category(db,category,subcategory)
            base={'sku':sku,'name':name,'description':data.get('description',name),'category':category,'subcategory':subcategory,'brand':'','compatibility':'','stock':0,'reserved_stock':0,'min_stock':0,'cost':0,'margin':0,'sale_price':0,'active':1}
            base.update(data); db.add(Product(**base)); created+=1; touched.append({'sku':sku,'action':'creado','fields':list(data.keys())})
    db.commit(); return {'created':created,'updated':updated,'skipped':skipped,'errors':errors[:30],'sample':touched[:20]}

@router.post('/products/adjust-prices')
def adjust_prices(p:PriceAdjustmentIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    percent=float(p.percent)
    if percent==0: raise HTTPException(400,'El porcentaje no puede ser 0')
    qry=db.query(Product).filter(Product.active==1)
    if p.category and p.category!='Todas': qry=qry.filter(func.lower(Product.category)==p.category.lower())
    if p.subcategory and p.subcategory!='Todas': qry=qry.filter(func.lower(Product.subcategory)==p.subcategory.lower())
    rows=qry.all(); updated=0
    factor=1+(percent/100)
    for prod in rows:
        base=(prod.sale_price or 0) if p.base=='sale_price' else (prod.cost or 0)
        if base<=0: continue
        prod.sale_price=round(base*factor,2); prod.updated_at=datetime.utcnow(); updated+=1
    db.commit(); return {'updated':updated,'percent':percent,'category':p.category,'subcategory':p.subcategory,'base':p.base}

@router.post('/product-suppliers')
def link(p:ProductSupplierIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    prod=db.query(Product).filter(Product.id==p.product_id).first(); s=db.query(Supplier).filter(Supplier.id==p.supplier_id).first()
    if not prod or not s: raise HTTPException(404,'Producto o proveedor no encontrado')
    calc=p.supplier_price*s.freight_coefficient
    x=db.query(ProductSupplier).filter(ProductSupplier.product_id==p.product_id,ProductSupplier.supplier_id==p.supplier_id,ProductSupplier.supplier_sku==p.supplier_sku).first()
    if x: x.supplier_price=p.supplier_price; x.supplier_stock=p.supplier_stock; x.calculated_cost=calc; x.updated_at=datetime.utcnow()
    else: db.add(ProductSupplier(product_id=p.product_id,supplier_id=p.supplier_id,supplier_sku=p.supplier_sku,supplier_price=p.supplier_price,supplier_stock=p.supplier_stock,calculated_cost=calc))
    prod.cost=calc; prod.sale_price=round(calc*(1+(prod.margin or 0)/100),2) if prod.margin else prod.sale_price
    db.add(CostHistory(product_id=prod.id,supplier_id=s.id,supplier_sku=p.supplier_sku,supplier_price=p.supplier_price,coefficient=s.freight_coefficient,final_cost=calc,sale_price=prod.sale_price,source='Asociacion manual'))
    db.commit(); return {'ok':True}

@router.post('/supplier-prices/import/{supplier_id}')
async def import_prices(supplier_id:int,file:UploadFile=File(...),db:Session=Depends(get_db),u:User=Depends(admin_only)):
    s=db.query(Supplier).filter(Supplier.id==supplier_id).first()
    if not s: raise HTTPException(404,'Proveedor no encontrado')
    df=pd.read_excel(file.file); cm=colmap(df); required=['SKU','COD','COSTO']; miss=[c for c in required if c not in cm]
    if miss: raise HTTPException(400,'Faltan columnas: '+', '.join(miss))
    created=updated=missing=0
    for _,r in df.iterrows():
        sku=clean(r[cm['SKU']]); supplier_sku=clean(r[cm['COD']]); price=num(r[cm['COSTO']]); supplier_stock=num(r[cm['STOCK']],0) if 'STOCK' in cm else 0
        if not sku: continue
        p=db.query(Product).filter(Product.sku==sku).first()
        if not p: missing+=1; continue
        calc=price*s.freight_coefficient
        if 'DESCRIPION' in cm and not p.name: p.name=clean(r[cm['DESCRIPION']])
        if 'MARGEN' in cm: p.margin=num(r[cm['MARGEN']],p.margin or 0)
        p.cost=calc; p.sale_price=round(calc*(1+(p.margin or 0)/100),2) if p.margin else p.sale_price
        x=db.query(ProductSupplier).filter(ProductSupplier.product_id==p.id,ProductSupplier.supplier_id==s.id,ProductSupplier.supplier_sku==supplier_sku).first()
        if x: x.supplier_price=price; x.supplier_stock=supplier_stock; x.calculated_cost=calc; x.updated_at=datetime.utcnow(); updated+=1
        else: db.add(ProductSupplier(product_id=p.id,supplier_id=s.id,supplier_sku=supplier_sku,supplier_price=price,supplier_stock=supplier_stock,calculated_cost=calc)); created+=1
        db.add(CostHistory(product_id=p.id,supplier_id=s.id,supplier_sku=supplier_sku,supplier_price=price,coefficient=s.freight_coefficient,final_cost=calc,sale_price=p.sale_price,source='Lista proveedor'))
    db.commit(); return {'created':created,'updated':updated,'missing_products':missing}

@router.post('/purchases/import/{supplier_id}')
async def import_purchase(supplier_id:int,file:UploadFile=File(...),db:Session=Depends(get_db),u:User=Depends(admin_only)):
    s=db.query(Supplier).filter(Supplier.id==supplier_id).first()
    if not s: raise HTTPException(404,'Proveedor no encontrado')
    df=pd.read_excel(file.file); cm=colmap(df); required=['SKU','CANTIDAD','COSTO']; miss=[c for c in required if c not in cm]
    if miss: raise HTTPException(400,'Faltan columnas: '+', '.join(miss))
    imported=missing=0; total_amount=0
    for _,r in df.iterrows():
        sku=clean(r[cm['SKU']]); qty=num(r[cm['CANTIDAD']]); cost=num(r[cm['COSTO']])
        if not sku or qty<=0: continue
        p=db.query(Product).filter(Product.sku==sku).first()
        if not p: missing+=1; continue
        p.stock=(p.stock or 0)+qty; p.cost=cost; p.sale_price=round(cost*(1+(p.margin or 0)/100),2) if p.margin else p.sale_price
        total=qty*cost; total_amount+=total; imported+=1
        db.add(Purchase(supplier_id=s.id,product_id=p.id,quantity=qty,unit_cost=cost,total=total))
        db.add(CostHistory(product_id=p.id,supplier_id=s.id,supplier_price=cost,coefficient=1,final_cost=cost,sale_price=p.sale_price,source='Compra'))
    db.commit(); return {'imported':imported,'missing_products':missing,'total':total_amount}

@router.post('/purchases')
def purchase(p:PurchaseIn,db:Session=Depends(get_db),u:User=Depends(admin_only)):
    prod=db.query(Product).filter(Product.id==p.product_id).first()
    if not prod: raise HTTPException(404,'Producto no encontrado')
    total=p.quantity*p.unit_cost; prod.stock=(prod.stock or 0)+p.quantity; prod.cost=p.unit_cost; x=Purchase(**p.model_dump(),total=total); db.add(x); db.commit(); db.refresh(x); return x
@router.get('/purchases')
def purchases(db:Session=Depends(get_db),u:User=Depends(current_user)): return db.query(Purchase).order_by(Purchase.id.desc()).all()

@router.post('/sales')
def sale(p:SaleIn,db:Session=Depends(get_db),u:User=Depends(current_user)):
    contact_id=p.contact_id
    if not contact_id and p.customer_name:
        c=db.query(Contact).filter(Contact.name==p.customer_name,Contact.phone==p.customer_phone).first()
        if not c:
            c=Contact(type='Cliente',name=p.customer_name,phone=p.customer_phone,document=p.customer_document,email=p.customer_email,address=p.customer_address); db.add(c); db.flush()
        contact_id=c.id
    x=Sale(type=p.type,status='Borrador' if p.type=='Presupuesto' else 'Registrado',contact_id=contact_id,customer_name=p.customer_name,customer_phone=p.customer_phone,customer_document=p.customer_document,customer_email=p.customer_email,customer_address=p.customer_address,payment_method=p.payment_method,seller=p.seller,discount=p.discount,notes=p.notes,total=0,subtotal=0)
    db.add(x); db.flush(); subtotal=0
    for it in p.items:
        prod=db.query(Product).filter(Product.id==it.product_id).first()
        if not prod: raise HTTPException(404,'Producto no encontrado')
        if p.type=='Pedido de venta':
            if (prod.stock or 0)<it.quantity: raise HTTPException(400,f'Stock insuficiente para {prod.sku}')
            prod.stock-=it.quantity
        line=it.quantity*it.unit_price; subtotal+=line; db.add(SaleItem(sale_id=x.id,product_id=prod.id,quantity=it.quantity,unit_price=it.unit_price,total=line))
    x.subtotal=subtotal; x.total=max(subtotal-(p.discount or 0),0); db.commit(); db.refresh(x); return x
@router.get('/sales')
def sales(db:Session=Depends(get_db),u:User=Depends(current_user)): return db.query(Sale).order_by(Sale.id.desc()).all()
