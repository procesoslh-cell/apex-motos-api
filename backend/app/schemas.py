from pydantic import BaseModel
from typing import List, Optional
class LoginIn(BaseModel): username:str; password:str
class UserIn(BaseModel): username:str; password:str; role:str='Sucursal'
class CategoryIn(BaseModel): name:str
class SubCategoryIn(BaseModel): category_id:int; name:str
class SupplierIn(BaseModel):
    name:str; business_name:str=''; cuit:str=''; fiscal_position:str='Responsable Inscripto'
    phone:str=''; whatsapp:str=''; email:str=''; website:str=''; salesperson:str=''
    address:str=''; city:str=''; province:str=''; postal_code:str=''; country:str='Argentina'
    freight_coefficient:float=1.0; notes:str=''; active:int=1
class ContactIn(BaseModel):
    type:str='Cliente'; name:str; document:str=''; fiscal_position:str='Consumidor Final'
    phone:str=''; whatsapp:str=''; email:str=''; address:str=''; city:str=''; province:str=''; postal_code:str=''; country:str='Argentina'; notes:str=''; active:int=1
class ProductIn(BaseModel):
    sku:str; name:str; description:str=''; category:str='General'; subcategory:str='General'; brand:str=''; compatibility:str=''
    stock:float=0; reserved_stock:float=0; min_stock:float=0; cost:float=0; margin:float=0; sale_price:float=0; active:int=1
class ProductSupplierIn(BaseModel): product_id:int; supplier_id:int; supplier_sku:str; supplier_price:float; supplier_stock:float=0
class PurchaseIn(BaseModel): supplier_id:int; product_id:int; quantity:float; unit_cost:float
class SaleItemIn(BaseModel): product_id:int; quantity:float; unit_price:float
class SaleIn(BaseModel):
    type:str='Pedido de venta'; payment_method:str='Efectivo'; seller:str=''; discount:float=0; notes:str=''
    contact_id:Optional[int]=None; customer_name:str=''; customer_phone:str=''; customer_document:str=''; customer_email:str=''; customer_address:str=''
    items:List[SaleItemIn]

class PriceAdjustmentIn(BaseModel):
    percent:float
    category:str=''
    subcategory:str=''
    base:str='sale_price'
