# Catan jugable (funcional) + ejecutable

Si quieres abrir el juego sin complicarte, usa el ejecutable incluido.

## Opción 1 (recomendada): abrir con "un click"
En la carpeta del proyecto, ejecuta:

```bash
./jugar-catan.sh
```

Ese script:
1. Arranca el servidor local.
2. Te abre el navegador automáticamente en el juego.

Para cerrar el juego, vuelve a la terminal y pulsa `Ctrl + C`.

---

## Opción 2 (manual)
Si prefieres manual:

```bash
python3 -m http.server 4173
```

Y abre:

- http://localhost:4173

---

## Cómo se juega (versión actual)
### Fase inicial obligatoria (como Catan)
- El juego empieza con colocación automática por turnos en orden:
  - `1-2-3-4-4-3-2-1`
- Cada jugador coloca:
  - 2 pueblos
  - 2 carreteras (cada una conectada al pueblo recién colocado)
- Al poner el **2º pueblo inicial**, ese jugador recibe recursos iniciales de los hexágonos adyacentes (excepto desierto).

### Fase normal
En cada turno:
1. Pulsa **🎲 Tirar dados**.
2. Si sale 7, hay descarte y debes colocar ladrón en una loseta con click.
3. Construye (si tienes recursos):
   - **Carretera**: click en una línea.
   - **Pueblo**: click en un punto válido.
   - **Ciudad**: click sobre uno de tus pueblos.
4. Opcional: comercio con banco **4:1**.
5. Pulsa **Finalizar turno**.

Gana quien llegue a **10 puntos**.

---

## Requisitos
- Tener `python3` instalado.
- Navegador web (Chrome, Firefox, Edge...).
