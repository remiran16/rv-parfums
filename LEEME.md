# NOIR — Tienda online de perfumería

Proyecto web estático (HTML/CSS/JS) con catálogo, carrito, pedidos por WhatsApp y panel privado de administración. Se publica gratis en Cloudflare Pages y usa Supabase Free para base de datos, autenticación y fotos.

## Antes de empezar
Necesitás cuentas gratuitas en:
- https://supabase.com/
- https://github.com/
- https://dash.cloudflare.com/

## PASO 1 — Crear la base de datos en Supabase
1. Entrá en Supabase y creá un proyecto nuevo (plan Free).
2. Guardá la contraseña de la base de datos en un lugar seguro.
3. Cuando el proyecto termine de inicializar, abrí **SQL Editor**.
4. Elegí **New query**, abrí el archivo `supabase-schema.sql`, copiá todo su contenido y ejecutalo con **Run**.
5. Entrá en **Project Settings > API** (o **Data API**) y copiá:
   - Project URL
   - anon / publishable key (NUNCA uses la `service_role` o secret key en la web).
6. En **Authentication > Sign In / Providers**, desactivá los registros públicos (Allow new users to sign up).
7. En **Authentication > Users**, elegí **Add user** y creá tu correo y contraseña de administrador. Confirmá el correo si Supabase te lo solicita.

## PASO 2 — Configurar el proyecto
1. Abrí `config.js`.
2. Reemplazá `PEGAR_AQUI_TU_PROJECT_URL` por tu Project URL.
3. Reemplazá `PEGAR_AQUI_TU_ANON_PUBLIC_KEY` por la anon/publishable key.
4. Reemplazá `595XXXXXXXXX` por tu WhatsApp con código de Paraguay, sin +, espacios ni guiones. Ejemplo de formato: `595981123456`.
5. Guardá el archivo.

La clave anon/publishable está diseñada para usarse en el navegador. La seguridad de los datos depende de las políticas RLS incluidas en el SQL. No publiques nunca una clave `service_role` o secret.

## PASO 3 — Probar en tu computadora
La forma más sencilla es instalar Visual Studio Code y la extensión **Live Server**:
1. Abrí la carpeta del proyecto en VS Code.
2. Instalá la extensión Live Server.
3. Hacé clic derecho en `index.html` y elegí **Open with Live Server**.
4. Probá el catálogo y entrá a `admin.html` para iniciar sesión.
5. Desde el panel agregá un perfume de prueba y verificá que aparezca en la tienda.

También podés abrir `index.html` directamente, pero Live Server evita algunas limitaciones del navegador.

## PASO 4 — Publicar gratis en GitHub
1. Creá un repositorio nuevo en GitHub, por ejemplo `noir-perfumeria`.
2. Subí todos los archivos de esta carpeta (no subas contraseñas ni claves secretas; `config.js` solo contiene la clave pública anon/publishable).
3. Asegurate de que `index.html`, `admin.html`, `config.js`, `store.js`, `admin.js` y `styles.css` estén en la raíz del repositorio.

## PASO 5 — Publicar en Cloudflare Pages
1. Entrá a Cloudflare Dashboard.
2. Abrí **Workers & Pages** > **Create** > **Pages** > **Connect to Git**.
3. Conectá GitHub y elegí el repositorio `noir-perfumeria`.
4. Framework preset: **None**.
5. Build command: dejalo vacío.
6. Build output directory: `/` o `.` según lo que solicite el panel.
7. Tocá **Save and Deploy**.
8. Cloudflare te dará una dirección como `nombre.pages.dev`.

Tu tienda pública será `https://nombre.pages.dev` y el administrador estará en `https://nombre.pages.dev/admin.html`.

## Cómo administrar la tienda
- Abrí `tudominio.pages.dev/admin.html`.
- Iniciá sesión con el usuario administrador creado en Supabase.
- Agregá perfumes con nombre, marca, categoría, descripción, precio, stock y foto.
- En la tabla podés editar, borrar y cambiar stock.
- Los pedidos recibidos aparecerán en la sección Pedidos y podrás actualizar su estado.

## Importante sobre stock y pedidos
Esta versión registra los pedidos y muestra el stock disponible, pero **no descuenta automáticamente el stock cuando alguien hace un pedido**. Esto es intencional en esta primera versión: evita que un pedido sin confirmar o duplicado reduzca tu inventario. Confirmá la venta y actualizá el stock desde el panel. Si querés, en una segunda etapa podemos agregar descuento automático seguro al confirmar el pedido.

## Límites del plan gratuito
Supabase Free incluye cuotas limitadas (por ejemplo, 500 MB de base de datos, 1 GB de almacenamiento y 5 GB de transferencia según su documentación vigente). Los proyectos gratuitos pueden pausarse tras una semana de inactividad. Cloudflare Pages Free tiene límites de despliegue y archivos, suficientes para comenzar con una tienda pequeña. Revisá los límites actuales antes de operar a mayor escala.

## Seguridad y operación
- Nunca compartas la contraseña del administrador.
- No pegues una clave `service_role` en `config.js`.
- Usá fotos optimizadas en JPG o WebP de hasta 5 MB.
- Hacé exportaciones periódicas de tus productos y pedidos.
- Probá primero con pedidos ficticios antes de compartir la tienda.
- Los pedidos no procesan pagos en línea: el cierre es por WhatsApp.
