# Validador de Firmas

Aplicacion Node.js para cargar PDFs desde un panel privado y generar un link publico permanente con codigo QR unico.

## Links publicos permanentes

La aplicacion no tiene vencimiento por tiempo para los links publicos. Cada documento se guarda con:

- `permanent: true`
- `expiresAt: null`

Un link publico solo dejaria de funcionar si se elimina el registro del documento o el archivo PDF del almacenamiento.

## Railway

Para que los links nunca se pierdan en Railway, configura un Volume persistente montado en:

```text
/app/data
```

La aplicacion guarda alli:

- `documents.json`
- `uploads/`

Variables recomendadas:

```env
PRIVATE_USER=admin
PRIVATE_PASSWORD=tu_clave_segura
PRIVATE_TOKEN=un_token_largo_aleatorio
```

Si no configuras un Volume persistente, Railway puede borrar los archivos en un redeploy o restart, y los links antiguos dejarian de funcionar aunque el codigo no tenga expiracion.
