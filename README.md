# Catan jugable — tú vs 3 CPUs (con doble click real)

He dejado launchers para que no tengas que abrir terminal manualmente.

## ✅ Forma recomendada (doble click)

### Windows
1. Haz doble click en **`Catan.bat`**.
2. Se abrirá el juego automáticamente en el navegador.

### macOS
1. Haz doble click en **`Catan.command`**.
2. Si macOS bloquea por seguridad, clic derecho → **Abrir**.
3. Se abrirá el juego en el navegador.

### Linux
- Puedes usar doble click en **`Catan.command`** (si tu entorno lo permite), o ejecutar:

```bash
./jugar-catan.sh
```

---

## Si no abre automáticamente
El lanzador imprime una URL como esta:

- `http://127.0.0.1:4173`

Cópiala y pégala en el navegador.
Si el puerto 4173 está ocupado, el lanzador usa otro libre (por ejemplo 4174) y te lo indica.


## Modo de juego
- Tú controlas al jugador **Rojo**.
- Los otros 3 jugadores (**Azul, Verde y Naranja**) son CPU automáticas.
- La CPU también hace su colocación inicial y sus turnos sin que tú pulses nada.

---

## Cerrar el juego
En la ventana de terminal/consola del lanzador, pulsa:

- `Ctrl + C`

---

## Requisitos
- Tener **Python 3** instalado.
- Navegador web.

---

## Archivos de arranque
- `Catan.bat` → doble click en Windows
- `Catan.command` → doble click en macOS/Linux
- `jugar-catan.sh` → ejecución por terminal en Linux/macOS
- `lanzar_catan.py` → lanzador principal
