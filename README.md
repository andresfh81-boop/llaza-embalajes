# Embalaje de perfiles (Llaza)

Calcula qué cajas y cuántas hacen falta para enviar los perfiles ya envueltos de una pérgola, y dibuja cómo van colocados en cada caja.

Funciona entera en el navegador: la hoja de corte en PDF no se sube a ningún servidor.

## Uso

1. Elige el tipo de embalaje (cartón, madera cerrada o madera abierta).
2. Arrastra la hoja de corte en PDF, o mete los perfiles a mano (perfil, largo, cantidad).
3. A la derecha salen las cajas necesarias, los m³ de transporte y el dibujo de cada caja.

## Catálogo de cajas y perfiles

El catálogo común está en `datos/catalogo.json`. Lo que cambies desde las pestañas **Cajas** y **Perfiles** se guarda solo en tu navegador. Para que lo vea todo el equipo, pulsa **Exportar catálogo** y pásale el archivo a Andrés, que lo sube aquí.

## Instalarla en Llaza

La app es solo archivos estáticos (sin servidor de aplicación ni base de datos): basta con copiar la carpeta entera a cualquier servidor web interno (IIS, Apache, nginx, una carpeta compartida servida por HTTP) o dejarla en GitHub Pages. Abierta como archivo suelto (`file://`) no funciona: hace falta servirla.

### Base de clientes

Con el nº de cliente del cajetín del plano («CLIENTE: 104530») la app busca la ciudad y el país del cliente y elige sola el embalaje (cartón, madera abierta o madera cerrada). La base **no va en este repositorio, que es público**. Dos formas de dársela:

- **Para todo el equipo**: poner junto a la app el archivo `datos/clientes.csv` (o `datos/clientes.json`). La app lo lee al abrirse. Están en `.gitignore` para que no se suban por error.
- **Solo en un ordenador**: pestaña **Clientes → Importar clientes**. Se guarda en ese navegador.

Formato: CSV exportado del programa de gestión o de Excel, separado por `;`, `,` o tabulador, con fila de cabecera. Columnas que entiende (en cualquier orden; el resto se ignoran): `codigo` (o «nº cliente», «cliente»), `nombre` (o «razón social»), `ciudad` (o «población», «localidad»), `provincia`, `pais` y, opcional, `embalaje` para forzar el de un cliente («cartón», «madera abierta», «madera cerrada»). Ejemplo con datos inventados: `datos/clientes.ejemplo.csv`. También vale JSON: una lista de objetos con esos mismos campos.

Si un cliente no está en la base o su lugar no se reconoce, se elige el embalaje a mano o escribiendo el país o la ciudad. Los países y ciudades que reconoce están en `LUGARES` de `static/nucleo.js`.

## Desarrollo

```bash
python -m http.server 8765
```

```bash
node pruebas/probar.js
```

Más detalle en `CLAUDE.md`.
