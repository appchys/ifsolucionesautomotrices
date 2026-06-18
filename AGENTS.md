<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Development data policy

This project is still in active development and does not need to preserve compatibility with existing data. There is no important production data yet, so schema changes can favor the clean current model over migrations or legacy fallbacks unless the user explicitly asks otherwise.

## UI simplicity

New features should keep the interface simple and avoid explanatory copy, repeated labels, or redundant controls. Prefer compact controls that show the current state directly and reveal secondary choices only when needed.

Recuerda siempre hablarme en español

No uses DOM o controlar pantalla a menos que el problema esté siendo muy dificil de resolver.

La aplicación debe funcionar como reloj suizo entre componentes.
Por ejemplo, si se registra la entrada o salida de dinero en alguna parte, debe reflejarse inmediatamente en las otras que lo muestran, ya sea en gráficos, números o tablas.
Debe tener un sistema de caché robusto pero invisible para el usuario.
El objetivo es que parezca una SPA con base de datos en tiempo real

Estamos en Ecuador, por lo tanto debes considerar que la moneda es el dólar americano, y las horas están en UTC-5.


Sobre los métodos de pago.
El taller maneja como métodos de pago: Efectivo, Tarjeta de Crédito, Tarjeta de Débito y Transferencia.  Los bancos a los cuales se les puede hacer transferencias son: Banco de Guayaquil, Pichincha, y Cooperativa JEP.
Los pagos con tarjetas de débito y crédito se acreditan a Banco Guayaquil, pero no se hacen efectivo el mismo día, por lo que deben tener una validación del día en que se acredita el pago.
Es decir, la validación se debe hacer con base en la fecha de registro del pago y la fecha de acreditación del pago y sabiendo en qué estado se encuentra esa transacción. Por ejemplo: Si el pago se registró un día viernes y la acreditación es el siguiente día hábil, entonces se debe esperar hasta el siguiente día hábil para que el pago se refleje en el balance.

La aplicación debe poder usarse en una laptop de pantalla de unas 13 o 14 pulgadas pudiendo ver los elementos sin problemas de espacio.  Es decir, la aplicación debe ser responsiva y compactando los componentes sin dejar tanto espacio en blanco.  Por ejemplo: En los dashboard no es necesario mostrar todos los meses del año, se puede mostrar una barra lateral con los meses y se pueda hacer scroll para ver los meses que no están visibles.  Debe usar el espacio de forma eficiente.

Todos los modales deben cerrarse al clicar fuera


