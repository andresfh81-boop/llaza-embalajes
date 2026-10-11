# Embalaje de perfiles (Llaza)

Calcula qué cajas y cuántas hacen falta para enviar los perfiles ya envueltos de una pérgola, y dibuja cómo van colocados en cada caja.

Funciona entera en el navegador: la hoja de corte en PDF no se sube a ningún servidor.

## Uso

1. Elige el tipo de embalaje (cartón, madera cerrada o madera abierta).
2. Arrastra la hoja de corte en PDF, o mete los perfiles a mano (perfil, largo, cantidad).
3. A la derecha salen las cajas necesarias, los m³ de transporte y el dibujo de cada caja.

## Catálogo de cajas y perfiles

El catálogo común está en `datos/catalogo.json`. Lo que cambies desde las pestañas **Cajas** y **Perfiles** se guarda solo en tu navegador. Para que lo vea todo el equipo, pulsa **Exportar catálogo** y pásale el archivo a Andrés, que lo sube aquí.

## Desarrollo

```bash
python -m http.server 8765
```

```bash
node pruebas/probar.js
```

Más detalle en `CLAUDE.md`.
