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
- El pedido en curso también se guarda en el navegador (clave `pedido-embalaje`).

## Qué hace

- Tres tipos de embalaje: cartón (envío local), madera cerrada (marítimo), madera abierta (terrestre).
- Pedido: líneas de perfil + largo + cantidad, a mano o arrastrando la hoja de corte en PDF.
- Resultado: nº de cajas, modelo de cada una, m³ de transporte (con medidas exteriores) y dibujo a escala de la sección de cada caja con los bultos colocados. Se pueden mezclar piezas distintas en la misma caja.

### Cómo calcula

- Cada bulto es un rectángulo (ancho × alto envuelto + holgura, 5 mm por defecto) que ocupa todo el largo de la caja.
- Encaje 2D en la sección interior de la caja (MaxRects, abajo-izquierda, con giro de 90°).
- Prueba cada modelo de caja del tipo elegido, se queda con el reparto de menos volumen exterior y después intenta bajar cada caja a un modelo más pequeño.
- **Por grupos** (`planGrupos`): cada perfil tiene `grupo` («estructura» o «lamas»). La estructura va junta en sus cajas y las lamas en las suyas (pedido por Andrés, 11/10/2026: «preferiblemente»). Solo se juntan dos cajas de grupos distintos cuando caben en una sola y así sobra una; esa caja sale marcada «Mezcla».
- Los bultos con protección en los extremos no se giran (si no, en la vista desde arriba salían sin protección).
- El total de bultos que se enseña cuenta los bultos de perfil más las cajas (pedido por Andrés, 12/10/2026), con el desglose al lado.
- Los bultos que no caben en ninguna caja se avisan aparte.
- **Retoque a mano** (`soltarSeccion`, `soltarPlanta`, `soltarAuto` en `app.js`): en el dibujo de frente el bulto se queda donde se suelta (con imán a paredes y a otros bultos), en la misma caja o en otra; en la vista desde arriba se desplaza a lo largo (`off`). Nada se recoloca solo. Se comprueba en 3D con `chocan`/`libre` de `nucleo.js`: si choca o se sale, aviso y no se mueve. Así se pueden poner a mano piezas cortas una detrás de otra. Soltar sobre una caja fuera de su dibujo, o en «Caja nueva», busca el primer hueco. Deja poner un bulto en el aire, pero avisa: `apoyado` (en `nucleo.js`) lo da por bueno si está en el suelo o justo encima de otro; si no, el bulto sale con borde rojo discontinuo y la caja lleva un aviso. Con el botón «Guardar reparto» se guardan en el navegador (clave `reparto-embalaje`: qué bultos van en cada caja y en qué posición) y vuelven al recargar; se descartan si cambia el pedido, el tipo, la holgura o el catálogo. «Volver al reparto automático» los deshace y borra lo guardado.
- Cada caja tiene dos dibujos: de frente (sección ancho × alto) y desde arriba (largo × ancho, con el ancho ampliado ×2). Las cotas van partidas: ocupado, libre (total menos lo que ocupan los bultos) y total interior. Cada bulto lleva su ancho y alto real, sin holgura, y el nombre corto del perfil (sin el paréntesis), no el código, con sus medidas debajo (ancho×alto×largo). En naranja, dentro del dibujo, van los huecos libres (`huecos` en `app.js`): encima de cada bulto hasta el siguiente o la tapa, y a su derecha hasta el siguiente o la pared, por tramos (un bulto tapado solo en parte enseña el hueco del resto). No se pintan huecos de menos de 15 mm.
- **Protección en los extremos (porexpan)**: las lamas miden 277 de ancho solo en los 300 mm de cada extremo; en el medio son más estrechas (dicho por Andrés, 11/10/2026). Si el perfil tiene `capL` (largo de cada protección) y `anchoMedio` (ancho en el medio), `filas()` en `nucleo.js` los pone en fila alternados —uno adelantado `capL` y el siguiente no— y n bultos ocupan (n-1)·(ancho+medio)/2 + ancho. Supone protección centrada, solo alterna a lo ancho (el alto no cambia), solo bultos iguales y del mismo largo, y la caja necesita `capL` de largo de sobra. Lamas y lamas LED: `anchoMedio` 200 (valor provisional de Andrés, editable en la pestaña Perfiles) y `capL` 300; los 277 de ancho ya incluyen el porexpan.

### Lectura de la hoja de corte

- Con pdf.js en el navegador; agrupa el texto en filas por coordenada Y (misma técnica que `llaza-etiquetas-web/static/extractor.js`).
- Fila esperada: `33000 LAMA 3854,5 mm 90º/90º 26` → referencia, pieza, largo, cantidad. "1+1" suma 2. El largo se redondea hacia arriba.
- El perfil se asigna por referencia; lo que no está en el catálogo queda como "No embalar" hasta elegirlo.

## Limitaciones conocidas

- Solo hay dos cajas en el catálogo común, las dos de cartón: C-5000 y C-7000 (alta de Andrés, 11/10/2026). Faltan las de madera cerrada y abierta.
- La lectura del PDF está comprobada con una hoja de corte real (módulo 4060×6000, 11/10/2026): leyó bien las 19 líneas. Para repetirlo sin navegador: `node pruebas/leer-pdf.js "hoja.pdf"`. Las hojas reales no se suben al repo (es público).
- No coloca dos perfiles cortos uno detrás de otro dentro de la misma caja.
- No tiene en cuenta peso ni peso máximo por caja.
- No es instalable ni funciona sin conexión (no lleva `manifest.json` ni `sw.js` como la app de etiquetas).

## Siguiente paso

1. Dar de alta las cajas reales y subirlas al catálogo común.

Ideas para después: colocar piezas cortas en fila, límite de peso, imprimir la lista de embalaje por caja, etiquetas por caja.
