from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class CustomerRegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    id_card: Optional[str] = ""
    password: str

class CustomerLoginRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    role_key: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

class ReadySaleRequest(BaseModel):
    garment_id: int
    customer_name: str
    customer_phone: Optional[str] = ""
    customer_id_card: Optional[str] = ""
    needs_quick_alteration: bool = False
    alteration_notes: Optional[str] = ""
    payment_method: str = "Efectivo"

class CustomOrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_id_card: str
    garment_type: str
    occasion: str
    fabric_selected: str
    measurements: Dict[str, float]
    total_price: float
    advance_payment: float  # Deberá ser >= 50%
    delivery_date: str      # YYYY-MM-DD
    weight_clause_acknowledged: bool = True
    assigned_tailor: Optional[str] = "Sastre & Patronista"
    payment_method: str = "Tarjeta de Débito/Crédito"
    notes: Optional[str] = ""

class CustomOrderUpdateStage(BaseModel):
    stage: str
    qc_status: Optional[str] = None
    qc_notes: Optional[str] = None
    final_fitting_result: Optional[str] = None
    notes: Optional[str] = None

class AlterationCreate(BaseModel):
    customer_name: str
    customer_phone: str
    garment_description: str
    alteration_details: str
    price: float
    estimated_delivery: str
    assigned_technician: Optional[str] = "Costurera Rosaura"
    paid: bool = False
    payment_method: Optional[str] = "Efectivo"
    notes: Optional[str] = ""

class AlterationUpdateStage(BaseModel):
    stage: str
    qc_status: Optional[str] = None
    qc_notes: Optional[str] = None
    status: Optional[str] = None
    paid: Optional[bool] = None

class RentalCreate(BaseModel):
    rental_item_id: int
    customer_name: str
    customer_phone: str
    customer_id_card: str
    event_date: str
    pickup_date: str
    return_due_date: str
    fitting_adjustments: Optional[str] = ""
    payment_method: str = "Tarjeta de Débito/Crédito"

class RentalReturnInspection(BaseModel):
    inspection_status: str  # "Optimo" o "Con_Danos"
    damage_fee: float = 0.0
    inspection_notes: str

class PurchaseOrderCreate(BaseModel):
    item_code: str
    quantity: float

class PayBalanceRequest(BaseModel):
    order_id: str
    amount: float
    payment_method: str = "Efectivo"
