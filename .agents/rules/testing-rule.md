---
name: testing-rule
description: Regla de validación continua y pruebas obligatorias tras cada cambio en Grand Legends TCG
always_on: true
---

# Regla de Validación Continua: Grand Legends TCG

## 🚨 Mandato
**Después de cada cambio en el código fuente (`js/`, `css/`, `index.html`), el asistente DEBE ejecutar una prueba interna automatizada para validar que nada se haya roto y todo funcione como debe funcionar.**

## Pasos Requeridos:
1. Validar que no haya errores de sintaxis (`SyntaxError`) ni funciones ausentes ejecutando `tests/verify_syntax.html`.
2. Validar que las 36+ pruebas de reglas de combate, IA adaptativa y motor visual pasen al 100% ejecutando `tests/test_runner.html`.
3. Si alguna aserción falla, corregir de inmediato la regresión antes de responder al usuario.
