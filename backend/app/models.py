from sqlalchemy import Column,Integer,String,Float,ForeignKey,DateTime,Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__='users'
    id=Column(Integer,primary_key=True); username=Column(String,unique=True,index=True,nullable=False); password_hash=Column(String,nullable=False); role=Column(String,default='Sucursal'); active=Column(Integer,default=1)

class Category(Base):
    __tablename__='categories'
    id=Column(Integer,primary_key=True); name=Column(String,unique=True,nullable=False); active=Column(Integer,default=1)
    subcategories=relationship('SubCategory',back_populates='category')

class SubCategory(Base):
    __tablename__='subcategories'
    id=Column(Integer,primary_key=True); category_id=Column(Integer,ForeignKey('categories.id'),nullable=False); name=Column(String,nullable=False); active=Column(Integer,default=1)
    category=relationship('Category',back_populates='subcategories')

class Contact(Base):
    __tablename__='contacts'
    id=Column(Integer,primary_key=True)
    type=Column(String,default='Cliente')
    name=Column(String,index=True,nullable=False)
    document=Column(String,default='')
    fiscal_position=Column(String,default='Consumidor Final')
    phone=Column(String,default=''); whatsapp=Column(String,default=''); email=Column(String,default='')
    address=Column(String,default=''); city=Column(String,default=''); province=Column(String,default=''); postal_code=Column(String,default=''); country=Column(String,default='Argentina')
    notes=Column(Text,default=''); active=Column(Integer,default=1); created_at=Column(DateTime,default=datetime.utcnow)

class Supplier(Base):
    __tablename__='suppliers'
    id=Column(Integer,primary_key=True)
    name=Column(String,unique=True,nullable=False) # nombre comercial
    business_name=Column(String,default=''); cuit=Column(String,default=''); fiscal_position=Column(String,default='Responsable Inscripto')
    phone=Column(String,default=''); whatsapp=Column(String,default=''); email=Column(String,default=''); website=Column(String,default=''); salesperson=Column(String,default='')
    address=Column(String,default=''); city=Column(String,default=''); province=Column(String,default=''); postal_code=Column(String,default=''); country=Column(String,default='Argentina')
    freight_coefficient=Column(Float,default=1.0); notes=Column(Text,default=''); active=Column(Integer,default=1); updated_at=Column(DateTime,default=datetime.utcnow)
    products=relationship('ProductSupplier',back_populates='supplier')

class Product(Base):
    __tablename__='products'
    id=Column(Integer,primary_key=True)
    sku=Column(String,unique=True,index=True,nullable=False)
    name=Column(String,nullable=False)
    description=Column(Text,default='')
    category=Column(String,default='General'); subcategory=Column(String,default='General'); brand=Column(String,default=''); compatibility=Column(Text,default='')
    stock=Column(Float,default=0); reserved_stock=Column(Float,default=0); min_stock=Column(Float,default=0)
    cost=Column(Float,default=0); margin=Column(Float,default=0); sale_price=Column(Float,default=0)
    active=Column(Integer,default=1); updated_at=Column(DateTime,default=datetime.utcnow)
    suppliers=relationship('ProductSupplier',back_populates='product')

class ProductSupplier(Base):
    __tablename__='product_suppliers'
    id=Column(Integer,primary_key=True); product_id=Column(Integer,ForeignKey('products.id'),nullable=False); supplier_id=Column(Integer,ForeignKey('suppliers.id'),nullable=False)
    supplier_sku=Column(String,index=True,nullable=False); supplier_price=Column(Float,default=0); supplier_stock=Column(Float,default=0); calculated_cost=Column(Float,default=0); updated_at=Column(DateTime,default=datetime.utcnow)
    product=relationship('Product',back_populates='suppliers'); supplier=relationship('Supplier',back_populates='products')

class CostHistory(Base):
    __tablename__='cost_history'
    id=Column(Integer,primary_key=True); product_id=Column(Integer,ForeignKey('products.id'),nullable=False); supplier_id=Column(Integer,ForeignKey('suppliers.id'),nullable=True)
    supplier_sku=Column(String,default=''); supplier_price=Column(Float,default=0); coefficient=Column(Float,default=1); final_cost=Column(Float,default=0); sale_price=Column(Float,default=0); source=Column(String,default='Manual'); created_at=Column(DateTime,default=datetime.utcnow)

class Purchase(Base):
    __tablename__='purchases'
    id=Column(Integer,primary_key=True); supplier_id=Column(Integer,ForeignKey('suppliers.id'),nullable=False); product_id=Column(Integer,ForeignKey('products.id'),nullable=False)
    quantity=Column(Float,nullable=False); unit_cost=Column(Float,nullable=False); total=Column(Float,nullable=False); created_at=Column(DateTime,default=datetime.utcnow)

class Sale(Base):
    __tablename__='sales'
    id=Column(Integer,primary_key=True); type=Column(String,default='Pedido de venta'); status=Column(String,default='Registrado')
    contact_id=Column(Integer,ForeignKey('contacts.id'),nullable=True); customer_name=Column(String,default=''); customer_phone=Column(String,default=''); customer_document=Column(String,default=''); customer_email=Column(String,default=''); customer_address=Column(String,default='')
    payment_method=Column(String,default='Efectivo'); seller=Column(String,default=''); discount=Column(Float,default=0); subtotal=Column(Float,default=0); total=Column(Float,default=0); notes=Column(Text,default='')
    created_at=Column(DateTime,default=datetime.utcnow); items=relationship('SaleItem',back_populates='sale')

class SaleItem(Base):
    __tablename__='sale_items'
    id=Column(Integer,primary_key=True); sale_id=Column(Integer,ForeignKey('sales.id'),nullable=False); product_id=Column(Integer,ForeignKey('products.id'),nullable=False)
    quantity=Column(Float,nullable=False); unit_price=Column(Float,nullable=False); total=Column(Float,nullable=False); sale=relationship('Sale',back_populates='items')
