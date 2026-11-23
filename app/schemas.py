from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CustomerRegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    id_card: Optional[str] = ""
    password: str


class CustomerLoginRequest(BaseModel):
    email: str
    password: str


class PublicProductRequest(BaseModel):
    request_type: str  # "Pieza de Exhibición", "Confección a la Medida", "Arreglo Menor"
    catalog_item_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    customer_id_card: Optional[str] = ""
    garment_description: str
    occasion: Optional[str] = ""
    fabric_preference: Optional[str] = ""
    desired_date: Optional[str] = ""
    needs_quick_adjustment: bool = False
    notes: Optional[str] = ""


class StaffLoginRequest(BaseModel):
    username: str
    password: str


class WorkerCreateRequest(BaseModel):
    username: str
    role_label: str
    role_type: str = "operativo"
    password: str
    allowed_views: List[str] = Field(default_factory=list)
    is_active: bool = True


class WorkerUpdateRequest(BaseModel):
    role_label: Optional[str] = None
    role_type: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    allowed_views: Optional[List[str]] = None


class WorkerPermissionsUpdateRequest(BaseModel):
    allowed_views: List[str]


class CatalogItemCreateRequest(BaseModel):
    name: str
    category: str
    size: str
    color: str
    style: str
    price: float
    stock: int = 1
    description: Optional[str] = ""
    image_url: Optional[str] = "/static/img/suit_grey.jpg"
    fabric: Optional[str] = ""
    delivery_time: Optional[str] = ""
    care_instructions: Optional[str] = ""


class CatalogItemUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    style: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    fabric: Optional[str] = None
    delivery_time: Optional[str] = None
    care_instructions: Optional[str] = None


class TicketCreateMostradorRequest(BaseModel):
    order_type: str  # "Confección a la Medida", "Pieza de Exhibición", "Arreglo Menor"
    catalog_item_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    customer_id_card: Optional[str] = ""
    garment_description: str
    occasion: Optional[str] = ""
    fabric_preference: Optional[str] = ""
    total_price: float
    advance_payment: float = 0.0
    delivery_date: Optional[str] = ""
    weight_clause_accepted: bool = True
    payment_method: str = "Efectivo"
    notes: Optional[str] = ""


class TicketConfirmWebRequest(BaseModel):
    total_price: float
    advance_payment: float = 0.0
    delivery_date: Optional[str] = ""
    weight_clause_accepted: bool = True
    payment_method: str = "Efectivo"
    send_to_tailor: bool = True
    notes: Optional[str] = ""


class TicketReturnToTailorRequest(BaseModel):
    adjustment_notes: str


class SastreMeasurementsUpdateRequest(BaseModel):
    measurements: Dict[str, Any]
    tailor_notes: Optional[str] = None
    interim_fitting_validated: Optional[bool] = None


class FabricRequestCreate(BaseModel):
    inventory_code: str
    quantity_requested: float
    notes: Optional[str] = ""


class SastreSendToQCRequest(BaseModel):
    tailor_notes: Optional[str] = None


class FabricRequestRejectRequest(BaseModel):
    notes: str


class PurchaseOrderCreate(BaseModel):
    item_code: str
    quantity: float


class QualityReviewRequest(BaseModel):
    decision: str  # "Aprobado" o "Rechazado"
    qc_notes: Optional[str] = ""
    checklist: Optional[Dict[str, bool]] = None


class FinalInvoicePaymentRequest(BaseModel):
    amount: float
    payment_method: str = "Efectivo"
    notes: Optional[str] = ""
