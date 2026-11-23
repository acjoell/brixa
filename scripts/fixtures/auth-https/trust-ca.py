"""Import a fixture CA into a private Chromium NSS database on Linux."""
import ctypes as c
from pathlib import Path
import sys


class SecItem(c.Structure):
    _fields_ = [("kind", c.c_int), ("data", c.c_char_p), ("length", c.c_uint)]


def bind(name, result, *args):
    function = getattr(nss, name)
    function.restype = result
    function.argtypes = args
    return function


def check(status):
    if status != 0:
        raise RuntimeError("No se pudo configurar la CA del perfil temporal de Chromium.")


nss = c.CDLL("libnss3.so")
pointer = c.c_void_p
string = c.c_char_p
integer = c.c_int
check(bind("NSS_InitReadWrite", integer, string)(f"sql:{sys.argv[1]}".encode()))
db = bind("CERT_GetDefaultCertDB", pointer)()
slot = bind("PK11_GetInternalKeySlot", pointer)()
if bind("PK11_NeedUserInit", integer, pointer)(slot):
    check(bind("PK11_InitPin", integer, pointer, string, string)(slot, None, b""))
der = Path(sys.argv[2]).read_bytes()
item = SecItem(0, der, len(der))
name = b"Brixa ephemeral HTTPS CA"
check(bind("PK11_ImportDERCert", integer, pointer, c.POINTER(SecItem), c.c_ulong, string, integer)(
    slot, c.byref(item), 0, name, 0
))
cert = bind("CERT_FindCertByNickname", pointer, pointer, string)(db, name)
if not cert:
    raise RuntimeError("La CA temporal no aparece en NSS.")
trust = (c.c_uint * 3)()
check(bind("CERT_DecodeTrustString", integer, pointer, string)(trust, b"C,,"))
check(bind("CERT_ChangeCertTrust", integer, pointer, pointer, pointer)(db, cert, trust))
bind("CERT_DestroyCertificate", None, pointer)(cert)
bind("PK11_FreeSlot", None, pointer)(slot)
check(bind("NSS_Shutdown", integer)())
