function actualizarAccesoUsuario(usuariosSheet, correo, cedula, accion) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = typeof usuariosSheet === "string"
      ? ss.getSheetByName(usuariosSheet)
      : usuariosSheet;

    if (!sheet) throw new Error("Hoja de usuarios no encontrada");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf("Email") + 1;
    const accesoCol = headers.indexOf("Acceso") + 1;

    if (emailCol === 0 || accesoCol === 0)
      throw new Error("No se encontraron las columnas 'Email' o 'Acceso'");

    // Normaliza la cédula a texto
    cedula = cedula.toString().trim();

    // ------------------------------------------------------
    // 1️⃣ Si la acción es "eliminar": remover la cédula del usuario actual
    // ------------------------------------------------------
    if (accion === "eliminar") {
      let eliminado = false;

      for (let i = 1; i < data.length; i++) {
        const email = data[i][emailCol - 1];
        const accesosTxt = data[i][accesoCol - 1]?.toString().trim() || "";
        let accesos = accesosTxt ? accesosTxt.split(",").map(a => a.trim()) : [];

        if (email === correo) {
          if (!accesos.includes(cedula)) throw new Error("cedula no eliminada");
          accesos = accesos.filter(a => a !== cedula);
          const nuevoValor = accesos.join(",");
          sheet.getRange(i + 1, accesoCol).setValue(nuevoValor);
          eliminado = true;
          break;
        }
      }

      if (!eliminado) throw new Error("usuario no encontrado");
      return "Acceso actualizado correctamente";
    }

    // ------------------------------------------------------
    // 2️⃣ Si la acción es "agregar": pasar la cédula al nuevo usuario
    // ------------------------------------------------------
    if (accion === "agregar") {
      let cedulaRemovida = false;
      let usuarioDestinoActualizado = false;

      // Primero eliminar la cédula de cualquier usuario que la tenga
      for (let i = 1; i < data.length; i++) {
        const accesosTxt = data[i][accesoCol - 1]?.toString().trim() || "";
        const accesos = accesosTxt ? accesosTxt.split(",").map(a => a.trim()) : [];

        if (accesos.includes(cedula)) {
          const nuevosAccesos = accesos.filter(a => a !== cedula);
          sheet.getRange(i + 1, accesoCol).setValue(nuevosAccesos.join(","));
          cedulaRemovida = true;
        }
      }

      // Luego agregarla al nuevo usuario destino
      for (let i = 1; i < data.length; i++) {
        const email = data[i][emailCol - 1];
        if (email === correo) {
          const accesosTxt = data[i][accesoCol - 1]?.toString().trim() || "";
          let accesos = accesosTxt ? accesosTxt.split(",").map(a => a.trim()).filter(a => a !== "") : [];
          if (!accesos.includes(cedula)) accesos.push(cedula);
          sheet.getRange(i + 1, accesoCol).setValue(accesos.join(","));
          usuarioDestinoActualizado = true;
          break;
        }
      }

      if (!usuarioDestinoActualizado) throw new Error("usuario no encontrado");
      return "Acceso actualizado correctamente";
    }

    throw new Error("acción no válida");
  } catch (e) {
    Logger.log(`Error en actualizarAccesoUsuario: ${e.message}`);
    throw e;
  }
}
