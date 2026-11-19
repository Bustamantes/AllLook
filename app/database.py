import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.getenv("DATABASE_PATH", "/app/data/alllook.db")

def ensure_db_dir():
    dirname = os.path.dirname(DB_PATH)
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname, exist_ok=True)

@contextmanager
def get_db():
    ensure_db_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    ensure_db_dir()
    with get_db() as conn:
        cursor = conn.cursor()

        # Tabla de Inventario de Telas e Insumos (Regla del 30% de reorden)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            unit TEXT NOT NULL,
            current_stock REAL NOT NULL,
            optimal_stock REAL NOT NULL,
            reorder_point REAL NOT NULL,
            cost_per_unit REAL NOT NULL,
            supplier TEXT NOT NULL,
            last_restock TEXT
        );
        """)

        # Tabla de Catálogo de Exhibición (Venta al Detal)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS catalog_ready (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            size TEXT NOT NULL,
            color TEXT NOT NULL,
            style TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            description TEXT,
            image_url TEXT
        );
        """)

        # Tabla de Catálogo de Alquiler de Trajes y Vestidos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS catalog_rental (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            size TEXT NOT NULL,
            color TEXT NOT NULL,
            rental_price REAL NOT NULL,
            security_deposit REAL NOT NULL,
            status TEXT DEFAULT 'Disponible',
            description TEXT,
            image_url TEXT
        );
        """)

        # Tabla de Confección a la Medida
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS custom_orders (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_id_card TEXT NOT NULL,
            garment_type TEXT NOT NULL,
            occasion TEXT NOT NULL,
            fabric_selected TEXT NOT NULL,
            measurements_json TEXT NOT NULL,
            total_price REAL NOT NULL,
            advance_payment REAL NOT NULL,
            remaining_balance REAL NOT NULL,
            order_date TEXT NOT NULL,
            delivery_date TEXT NOT NULL,
            interim_fitting_date TEXT NOT NULL,
            interim_fitting_status TEXT DEFAULT 'Pendiente',
            weight_clause_acknowledged INTEGER DEFAULT 1,
            stage TEXT NOT NULL DEFAULT 'Toma de Medidas y Anticipo',
            assigned_tailor TEXT,
            qc_status TEXT DEFAULT 'Pendiente',
            qc_notes TEXT,
            final_fitting_result TEXT DEFAULT 'Pendiente',
            completed_date TEXT,
            days_waiting INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'En Proceso',
            notes TEXT
        );
        """)

        # Tabla de Arreglos y Ajustes
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS alterations (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            garment_description TEXT NOT NULL,
            alteration_details TEXT NOT NULL,
            price REAL NOT NULL,
            order_date TEXT NOT NULL,
            estimated_delivery TEXT NOT NULL,
            stage TEXT NOT NULL DEFAULT 'Recepción',
            assigned_technician TEXT,
            qc_status TEXT DEFAULT 'Pendiente',
            qc_notes TEXT,
            paid INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'En Taller',
            notes TEXT
        );
        """)

        # Tabla de Alquileres de Prendas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS rentals (
            id TEXT PRIMARY KEY,
            rental_item_id INTEGER NOT NULL,
            garment_name TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_id_card TEXT NOT NULL,
            event_date TEXT NOT NULL,
            pickup_date TEXT NOT NULL,
            return_due_date TEXT NOT NULL,
            actual_return_date TEXT,
            rental_fee REAL NOT NULL,
            security_deposit REAL NOT NULL,
            deposit_refunded REAL DEFAULT 0,
            damage_fee REAL DEFAULT 0,
            fitting_adjustments TEXT,
            status TEXT NOT NULL DEFAULT 'Reservado',
            inspection_status TEXT DEFAULT 'Pendiente',
            inspection_notes TEXT,
            FOREIGN KEY (rental_item_id) REFERENCES catalog_rental(id)
        );
        """)

        # Tabla de Facturación y Comprobantes
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            order_ref TEXT NOT NULL,
            invoice_type TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT,
            customer_id_card TEXT,
            date TEXT NOT NULL,
            concept TEXT NOT NULL,
            subtotal REAL NOT NULL,
            tax REAL NOT NULL,
            total REAL NOT NULL,
            amount_paid REAL NOT NULL,
            balance_due REAL NOT NULL,
            payment_method TEXT NOT NULL,
            notes TEXT
        );
        """)

        # Tabla de Órdenes de Reabastecimiento a Proveedores
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY,
            item_code TEXT NOT NULL,
            item_name TEXT NOT NULL,
            supplier TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            estimated_cost REAL NOT NULL,
            date_ordered TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'En Camino'
        );
        """)

        # Tabla de Cuentas de Clientes (Login y Registro Normal de Clientes)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            id_card TEXT,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
