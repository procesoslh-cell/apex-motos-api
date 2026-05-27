from .models import User, Supplier, Product, ProductSupplier, Category, SubCategory, Contact
from .security import hash_password

def seed(db):
    admin = db.query(User).filter(User.username == "admin").first()

    if not admin:
        db.add(User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="Admin",
            active=1
        ))
    else:
        admin.password_hash = hash_password("admin123")
        admin.role = "Admin"
        admin.active = 1

    model = {
        'Motor': ['Filtros', 'Juntas', 'Pistones', 'Aros', 'Valvulas', 'Cilindros'],
        'Frenos': ['Pastillas', 'Zapatas', 'Discos', 'Cables', 'Bombas'],
        'Transmision': ['Cadenas', 'Coronas', 'Piñones', 'Kits transmision'],
        'Electricidad': ['Baterias', 'Lamparas', 'Reguladores', 'Bobinas', 'CDI'],
        'Suspension': ['Amortiguadores', 'Barrales', 'Retenes', 'Rulemanes'],
        'Carroceria': ['Plasticos', 'Espejos', 'Manijas', 'Guardabarros'],
        'Cubiertas': ['Cubiertas', 'Camaras', 'Valvulas'],
        'Lubricantes': ['Aceites', 'Grasas', 'Aditivos'],
        'Herramientas': ['Manual', 'Taller', 'Medicion'],
        'Accesorios': ['Cascos', 'Baules', 'Candados', 'Fundas']
    }

    for cname, subs in model.items():
        c = db.query(Category).filter(Category.name == cname).first()
        if not c:
            c = Category(name=cname)
            db.add(c)
            db.flush()

        for sname in subs:
            exists = db.query(SubCategory).filter(
                SubCategory.category_id == c.id,
                SubCategory.name == sname
            ).first()
            if not exists:
                db.add(SubCategory(category_id=c.id, name=sname))

    for name, coef in [('Proveedor Norte', 1.12), ('MotoPartes Sur', 1.18), ('Repuestos Centro', 1.08)]:
        if not db.query(Supplier).filter(Supplier.name == name).first():
            db.add(Supplier(
                name=name,
                business_name=name + ' SRL',
                freight_coefficient=coef,
                notes='Proveedor inicial',
                city='Cordoba',
                province='Cordoba',
                country='Argentina'
            ))

    if not db.query(Contact).filter(Contact.name == 'Cliente mostrador').first():
        db.add(Contact(
            type='Cliente',
            name='Cliente mostrador',
            fiscal_position='Consumidor Final'
        ))

    db.commit()

    if db.query(Product).count() == 0:
        db.add_all([
            Product(sku='APX-001', name='Filtro de aceite 110cc', category='Motor', subcategory='Filtros', brand='Generico', stock=25, min_stock=5, cost=2500, margin=60, sale_price=4000),
            Product(sku='APX-002', name='Pastilla de freno delantera', category='Frenos', subcategory='Pastillas', brand='Generico', stock=15, min_stock=4, cost=3200, margin=55, sale_price=4960),
            Product(sku='APX-003', name='Cadena 428H', category='Transmision', subcategory='Cadenas', brand='Generico', stock=10, min_stock=3, cost=7000, margin=45, sale_price=10150)
        ])
        db.commit()

        s = db.query(Supplier).first()
        for p in db.query(Product).all():
            db.add(ProductSupplier(
                product_id=p.id,
                supplier_id=s.id,
                supplier_sku='P-' + p.sku,
                supplier_price=p.cost / s.freight_coefficient,
                calculated_cost=p.cost,
                supplier_stock=p.stock
            ))

    db.commit()
