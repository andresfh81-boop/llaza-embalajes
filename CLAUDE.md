# Embalaje de perfiles (Llaza)

App web para calcular qué cajas y cuántas hacen falta para enviar los perfiles ya envueltos de una pérgola. La usa todo el equipo. Hablar siempre en español de España, claro y directo.

## Estado a 11/10/2026

Pasada de artifact de Claude a app web propia, sin servidor y sin depender de Claude ni de ninguna CDN. Repo: https://github.com/andresfh81-boop/llaza-embalajes (público). Publicada con GitHub Pages desde `main` en https://andresfh81-boop.github.io/llaza-embalajes/ — cada `git push` a `main` la actualiza en un par de minutos.

La versión anterior sigue publicada como artifact (https://claude.ai/artifact/JQvLXWkYkR8TwTvwkkpTy1); su catálogo era la base de datos del artifact y no se ha traído nada de allí salvo los 5 perfiles.

## Ficheros

- `index.html` — la página.
- `static/estilo.css` — estilos (claro y oscuro según el sistema).
- `static/nucleo.js` — cálculo sin interfaz: `parseHoja`, `packWith`, `plan`, y la mezcla de catálogo `aplicar` / `diferencia`. Se carga igual en el navegador y en Node.
- `static/app.js` — interfaz: pedido, catálogos, lectura del PDF, exportar/importar.
- `datos/catalogo.json` — catálogo común: `{ "perfiles": [...], "cajas": [...] }`, medidas en mm.
- `vendor/pdfjs/` — pdf.js 3.11.174, la misma copia que `llaza-etiquetas-web`.
- `manifest.json`, `sw.js` e iconos en `static/` — la app se puede instalar en ordenador y móvil y funciona sin conexión (12/10/2026), igual que `llaza-etiquetas-web`. `sw.js` va con «red primero»: con internet siempre pide lo último y guarda copia; sin conexión sirve la copia. Si se añaden archivos nuevos a la app, apuntarlos en `APP_SHELL` y subir el número de `CACHE_NAME`.
- `pruebas/probar.js` — `node pruebas/probar.js`.
- `ejemplos/` — todavía no existe; aquí irán las hojas de corte reales de muestra (ojo: el repo es público, sin datos de clientes).

**Al cambiar `static/estilo.css`, `nucleo.js` o `app.js`, subir el número `?v=N` de `index.html`**: si no, los navegadores siguen con la copia vieja en caché (pasó el 11/10/2026).

Para verla en local hace falta servirla (abierta como archivo suelto no carga el catálogo): `python -m http.server 8765` y abrir http://localhost:8765.

## Catálogo: común + cambios del navegador

- Lo común está en `datos/catalogo.json` y lo ve todo el equipo.
- Lo que alguien da de alta, cambia o borra desde la app se guarda solo en su navegador (`localStorage`, clave `catalogo-embalaje`) como diferencias sobre el común: `{perfiles:{id: ficha | null}, cajas:{...}}`, con `null` = borrado.
- En las pestañas Cajas y Perfiles hay una barra que dice cuántos cambios propios hay, con **Exportar catálogo** (descarga `catalogo.json` con el catálogo completo tal como lo ve esa persona), **Importar catálogo** y **Descartar mis cambios**.
- Para pasar cambios al común: sustituir `datos/catalogo.json` por el archivo exportado y publicar. Como los cambios locales se comparan con el común, al coincidir desaparecen solos.
- `montados` (solo en `datos/catalogo.json`, no se edita desde la app): referencias que van montadas en otro perfil y no llevan bulto propio — tapas, soporte medio lama, transmisión y LED perimetral en la viga; tapa pilar en el pilar. La app las lee de la hoja y las marca «Va montado en…» sin avisar de que faltan.
- Lama LED (33020) y media lama (33000) se envuelven igual que la lama normal, en bultos de 2 (dicho por Andrés, 11/10/2026).
- Cada ficha lleva un `id` fijo (en los perfiles iniciales, la referencia). Las líneas del pedido apuntan a ese `id`: no cambiarlo.
- **La app se abre siempre con el pedido vacío** (pedido por Andrés, 12/10/2026). El último pedido sigue guardado en el navegador (clave `pedido-embalaje`) y se puede traer con el botón «Recuperar el último pedido», que también recupera su reparto guardado; en cuanto se empieza un pedido nuevo, lo sustituye.

## Qué hace

- Tres tipos de embalaje: cartón (envío local), madera cerrada (marítimo), madera abierta (terrestre).
- Pedido: líneas de perfil + largo + cantidad, a mano o arrastrando la hoja de corte en PDF.
- Resultado: nº de cajas, modelo de cada una, m³ de transporte (con medidas exteriores) y dibujo a escala de la sección de cada caja con los bultos colocados. Se pueden mezclar piezas distintas en la misma caja.

### Cómo calcula

- Cada bulto es un rectángulo (ancho × alto envuelto + holgura, 5 mm por defecto) que ocupa todo el largo de la caja.
- Encaje 2D en la sección interior de la caja (MaxRects, abajo-izquierda, con giro de 90°).
- **No garantiza el óptimo**: es una colocación por reglas (heurística). `plan` prueba cada modelo de caja con cuatro órdenes de colocación (`ORDENES`: por sección, alto, ancho y lado mayor) y se queda con el mejor. En pantalla sale la sección aprovechada y el mínimo de cajas por superficie, que es una cota inferior y no siempre se puede alcanzar.
- **Girar a mano**: clic derecho en un bulto del dibujo de frente lo gira 90° en el sitio (`girarBulto`); la tecla R mientras se arrastra gira lo que se lleva. Los bultos con protección en los extremos también se giran a mano: su parte estrecha pasa del ancho (`medio`) al alto (`medioH`). El reparto automático no los gira.
- Prueba cada modelo de caja del tipo elegido, se queda con el reparto de menos volumen exterior y después intenta bajar cada caja a un modelo más pequeño.
- **Carga repartida a lo largo** (`repartir` en `nucleo.js`; pedido por Andrés, 12/10/2026, porque salía todo pegado a un extremo): al terminar el reparto, en cada caja los bultos se van poniendo a un extremo o al otro, de abajo arriba y del más largo al más corto, eligiendo el lado que deja el peso más centrado (el peso se estima por volumen: largo × sección). Lo de encima no pierde su apoyo y las filas de lamas alternadas se mueven en bloque.
- **Por grupos** (`planGrupos`): cada perfil tiene `grupo` («estructura» o «lamas»). La estructura va junta en sus cajas y las lamas en las suyas (pedido por Andrés, 11/10/2026: «preferiblemente»). Solo se juntan dos cajas de grupos distintos cuando caben en una sola y así sobra una; esa caja sale marcada «Mezcla».
- Los bultos con protección en los extremos no se giran (si no, en la vista desde arriba salían sin protección).
- El total de bultos que se enseña cuenta los bultos de perfil más las cajas (pedido por Andrés, 12/10/2026), con el desglose al lado.
- Cada bulto sabe cuántas piezas lleva (`it.n`; el último de una línea puede ir incompleto). En los perfiles que se envuelven de varias en varias (lamas, canalón) sale «2 uds» en los dibujos y el total de piezas en las listas y en la hoja impresa.
- Los bultos que no caben en ninguna caja se avisan aparte.
- **Añadir caja a mano**: la tarjeta «Añadir caja» del resultado tiene un desplegable con todos los modelos de todos los tipos (`modeloNuevo`); «Añadir caja vacía» la suma al reparto y soltar un bulto encima crea una caja de ese modelo. Una caja vacía lleva el botón «Quitar caja». Se puede mezclar tipos en un mismo reparto.
- **Aparcamiento**: zona encima de las cajas (`reparto.aparcados`, tarjeta `data-caja="ap"`) donde dejar bultos fuera de las cajas mientras se recoloca el resto. Se aparca soltando el bulto encima o con el botón «Aparcar» de la barra de selección; se devuelve arrastrando su ficha al dibujo de una caja o con un clic y eligiendo la caja. `origen(de,k)` da el bulto esté en una caja o aparcado (`de==='ap'`). Los aparcados cuentan como bultos, salen avisados en pantalla, en el resumen y en la lista impresa, y se guardan con «Guardar reparto». Aparcar no borra la caja aunque quede vacía.
- **Lista de embalaje** (`imprimirLista` en `app.js`): el botón «Imprimir lista de embalaje» rellena `#imprimir` y abre la impresión del navegador: una hoja de resumen y una hoja A4 por caja con modelo, medidas, tabla de bultos (perfil, largo, piezas por bulto, marcaje y casilla de hecho) y los dos dibujos tal como estén colocados. Cada caja tiene además su botón «Imprimir» (`imprimirLista(n)`), que saca solo esa caja con una tabla «Posición de cada bulto» (`posiciones`): un bulto por fila, con sus medidas y su distancia desde la izquierda, altura y desde el fondo. La cabecera lleva la «Referencia del pedido» (`pedido.ref`), que se rellena sola con el nombre del PDF. Estilos en `@media print` de `estilo.css`.
- **Pasar un bulto a otra caja sin arrastrar**: un clic en un bulto lo selecciona (`sel`) y sale una barra fija abajo con un botón por caja, «Caja nueva», «Girar» y «Cancelar»; el bulto va al primer hueco libre de la caja elegida (`soltarAuto`). Pedido por Andrés para repartos de muchas cajas. Al arrastrar, la página se desplaza sola cerca del borde superior o inferior.
- **Pantalla completa**: botón en cada caja, o varias a la vez marcando su casilla «Seleccionar» (`marcadas`) y pulsando «Ver en pantalla completa». `completa` es el conjunto de cajas a la vista (hasta 3 por fila); entre ellas se arrastran bultos con normalidad. Esc o «Salir de pantalla completa» la cierran. Convive con los botones − y +.
- **Ampliar**: cada dibujo lleva botones − y + (y «Normal») que lo amplían de 10 en 10 % (pasos mayores a partir de ×2) hasta ×4 dentro de su recuadro (`visor`, `cambiarZoom`, estado en `zoom`); ampliado, se arrastra el fondo para desplazarse. Elegido por Andrés el 12/10/2026 en vez de la ampliación a pantalla completa con clic, que se quitó. Los bultos se siguen pudiendo mover con el dibujo ampliado, también a otras cajas.
- **Retoque a mano** (`soltarSeccion`, `soltarPlanta`, `soltarAuto` en `app.js`): en el dibujo de frente el bulto se queda donde se suelta (con imán a paredes y a otros bultos), en la misma caja o en otra; en la vista desde arriba se mueve a lo largo (`off`) y a lo ancho (`x`), en la misma caja o en otra; como el alto no se ve, se queda a su altura si puede y, si no, en el hueco más bajo de ese sitio. Nada se recoloca solo. Se comprueba en 3D con `chocan`/`libre` de `nucleo.js`: si choca o se sale, aviso y no se mueve. Así se pueden poner a mano piezas cortas una detrás de otra. Soltar sobre una caja fuera de su dibujo, o en «Caja nueva», busca el primer hueco. Deja poner un bulto en el aire, pero avisa: `apoyado` (en `nucleo.js`) lo da por bueno si está en el suelo o justo encima de otro; si no, el bulto sale con borde rojo discontinuo y la caja lleva un aviso. Con el botón «Guardar reparto» se guardan en el navegador (clave `reparto-embalaje`: qué bultos van en cada caja y en qué posición) y vuelven al recargar; se descartan si cambia el pedido, el tipo, la holgura o el catálogo. «Volver al reparto automático» los deshace y borra lo guardado.
- Cada caja tiene dos dibujos: de frente (sección ancho × alto) y desde arriba (largo × ancho, con el ancho ampliado ×2). Las cotas van partidas: ocupado, libre (total menos lo que ocupan los bultos) y total interior. Cada bulto lleva su ancho y alto real, sin holgura, y el nombre corto del perfil (sin el paréntesis), no el código, con sus medidas debajo al mismo tamaño de letra, en dos líneas (ancho×alto y ×largo). En naranja, dentro del dibujo, van los huecos libres (`huecos` en `app.js`): encima de cada bulto hasta el siguiente o la tapa, y a su derecha hasta el siguiente o la pared, por tramos (un bulto tapado solo en parte enseña el hueco del resto). No se pintan huecos de menos de 15 mm.
- **Protección en los extremos (porexpan)**: las lamas miden 277 de ancho solo en los 300 mm de cada extremo; en el medio son más estrechas (dicho por Andrés, 11/10/2026). Si el perfil tiene `capL` (largo de cada protección) y `anchoMedio` (ancho en el medio), `filas()` en `nucleo.js` los pone en fila alternados —uno adelantado `capL` y el siguiente no— y n bultos ocupan (n-1)·(ancho+medio)/2 + ancho. Supone protección centrada, solo alterna a lo ancho (el alto no cambia), solo bultos iguales y del mismo largo, y la caja necesita `capL` de largo de sobra. Lamas y lamas LED: `anchoMedio` 200 (valor provisional de Andrés, editable en la pestaña Perfiles) y `capL` 300; los 277 de ancho ya incluyen el porexpan.

### Lectura de la hoja de corte

- Con pdf.js en el navegador; agrupa el texto en filas por coordenada Y (misma técnica que `llaza-etiquetas-web/static/extractor.js`).
- Fila esperada: `33000 LAMA 3854,5 mm 90º/90º 26` → referencia, pieza, largo, cantidad. "1+1" suma 2. El largo se redondea hacia arriba.
- **Marcaje** (`leerPagina` en `nucleo.js`): se lee de la columna MARCAJE de la hoja, que trae una o dos marcas por fila, una línea por encima y otra por debajo (V1-2 / V4-5, P3 / P6, C1-2 / C4-5), a veces troceadas en varios textos. Las casillas «1ª:», «n/2:» de las lamas no son marcaje. Cada línea del pedido guarda sus `marcas` y cada bulto se lleva las de las piezas que contiene, en el orden de la hoja (un bulto de 2 lleva dos). Sale en los dos dibujos, en la lista de cada caja, en los avisos y en «Copiar resumen»; se puede corregir en la tabla de lo leído y escribir a mano al añadir una línea.
- **Varias hojas y módulos**: se pueden arrastrar o elegir varias hojas de corte a la vez (una pérgola grande trae una por módulo o grupo de módulos). `leerCabecera` (en `nucleo.js`) saca de cada hoja el número («HOJA DE CORTE 54007372»), el nombre de la pérgola, tipología, medidas de la pérgola, «DIMENS. MÓDULO 1» / «MÓDULO 2-3» y los colores de estructura y lamas. Cada hoja se guarda en `pedido.hojas` y sus líneas llevan `mod` («M1», «M2-3») y `hoja`. La hoja «MÓDULO 2-3» no dice qué pieza es del 2 y cuál del 3: sale como «M2-3» y el módulo de cada línea se puede corregir a mano en la tabla de lo leído. El módulo va escrito en cada bulto siempre que la hoja lo traiga (también con un solo módulo). El relleno de cada bulto es el color de su perfil (12 colores, `--p0`…`--p11`); con más de un módulo, el borde del bulto lleva el color del módulo (`--m0`…`--m3`, `trazo` en `app.js`). Cambiado el 12/10/2026: antes el relleno era por módulo; hay leyenda en el resultado, en el bloque «Hojas de corte del pedido» de la columna izquierda (con los datos de la pérgola y un «Quitar» por hoja) y en la lista impresa.
- **Al arrastrar las hojas se añaden y se calcula directamente** (`volcarLeidas`; pedido por Andrés, 12/10/2026, que no veía el paso intermedio). Todo lo que tiene perfil va al pedido; lo montado en otro perfil se descarta y se cuenta en el mensaje; solo se quedan en la tabla «Leído de…» las líneas cuya referencia no está en el catálogo, para elegirles perfil y añadirlas o descartarlas. Volver a arrastrar una hoja ya añadida sustituye sus líneas. El módulo de cada línea se corrige en la tabla del pedido (casilla junto al perfil) cuando hay varias hojas o módulos.
- El perfil se asigna por referencia; lo que no está en el catálogo queda como "No embalar" hasta elegirlo.

## Limitaciones conocidas

- Cajas del catálogo común: cartón C-5000 y C-7000 (alta de Andrés, 11/10/2026); madera cerrada MC-5000 y MC-7000 y madera abierta MA-5000 y MA-7000 son copias con las mismas medidas, provisionales hasta medir las de madera reales (12/10/2026).
- La lectura del PDF está comprobada con una hoja de corte real (módulo 4060×6000, 11/10/2026): leyó bien las 19 líneas. Para repetirlo sin navegador: `node pruebas/leer-pdf.js "hoja.pdf"`. Las hojas reales no se suben al repo (es público).
- No coloca dos perfiles cortos uno detrás de otro dentro de la misma caja.
- No tiene en cuenta peso ni peso máximo por caja.

## Siguiente paso

1. Dar de alta las cajas reales y subirlas al catálogo común.

Ideas para después: límite de peso, etiquetas por caja.
