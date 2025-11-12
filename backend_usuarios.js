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

    // -G´DIGO NUEVO CUALQUIER COSA ELIMINAR LO QUE ESTA ARRIBA
    // ------------------------------------------------------

// backend_usuarios.js
// CRUD de Usuarios, hoja: "Usuarios", columnas: Email | Nombre | Rol | Acceso

function _canManageUsuarios_() {
  // Solo administrador puede editar usuarios
  const u = getUserRole();
  return (u.role || '').toLowerCase() === 'administrador';
}

// Listar usuarios
function getUsuariosData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Usuarios');
    if (!sh) throw new Error("Hoja 'Usuarios' no encontrada");

    const data = sh.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const emailIdx = headers.indexOf('Email');
    const nombreIdx = headers.indexOf('Nombre');
    const rolIdx = headers.indexOf('Rol');
    const accesoIdx = headers.indexOf('Acceso');
    if (emailIdx == -1 || nombreIdx == -1 || rolIdx == -1 || accesoIdx == -1) throw new Error("Encabezados inválidos");

    return data.slice(1)
      .filter(r => r[emailIdx])
      .map(r => ({
        Email: r[emailIdx],
        Nombre: r[nombreIdx],
        Rol: r[rolIdx],
        Acceso: r[accesoIdx]
      }));
  } catch (e) {
    Logger.log("getUsuariosData: " + e.message);
    return [];
  }
}

// Crear usuario
function agregarUsuarioGS(data) {
  try {
    if (!_canManageUsuarios_()) return { success: false, error: "No autorizado" };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Usuarios');
    if (!sh) throw new Error("Hoja 'Usuarios' no encontrada");

    const existentes = getUsuariosData();
    // Email único
    if (existentes.some(u => String(u.Email).toLowerCase() === String(data.Email).toLowerCase())) {
      return { success: false, error: "Ya existe un usuario con ese email" };
    }
    // Rol válido
    const rolesValidos = ['Administrador','Docente','Encargado'];
    if (!rolesValidos.includes(data.Rol)) {
      return { success: false, error: "Rol inválido" };
    }
    sh.appendRow([data.Email, data.Nombre, data.Rol, data.Acceso]);
    return { success: true, message: "Usuario agregado correctamente" };
  } catch (e) {
    Logger.log("agregarUsuarioGS: " + e.message);
    return { success: false, error: e.message };
  }
}

// Editar usuario
function editarUsuarioGS(data) {
  try {
    if (!_canManageUsuarios_()) return { success: false, error: "No autorizado" };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Usuarios');
    if (!sh) throw new Error("Hoja 'Usuarios' no encontrada");

    const values = sh.getDataRange().getValues();
    const headers = values[0].map(h => String(h).trim());
    const emailIdx = headers.indexOf('Email');
    const nombreIdx = headers.indexOf('Nombre');
    const rolIdx = headers.indexOf('Rol');
    const accesoIdx = headers.indexOf('Acceso');
    if (emailIdx == -1) throw new Error("Encabezados inválidos");

    const rowIdx = values.findIndex(r => String(r[emailIdx]).toLowerCase() === String(data.Email).toLowerCase());
    if (rowIdx <= 0) return { success: false, error: "Usuario no encontrado" };
    // Rol válido
    const rolesValidos = ['Administrador','Docente','Encargado'];
    if (!rolesValidos.includes(data.Rol)) {
      return { success: false, error: "Rol inválido" };
    }
    sh.getRange(rowIdx + 1, nombreIdx + 1).setValue(data.Nombre);
    sh.getRange(rowIdx + 1, rolIdx + 1).setValue(data.Rol);
    sh.getRange(rowIdx + 1, accesoIdx + 1).setValue(data.Acceso);
    return { success: true, message: "Usuario actualizado correctamente" };
  } catch (e) {
    Logger.log("editarUsuarioGS: " + e.message);
    return { success: false, error: e.message };
  }
}

// Eliminar usuario
function eliminarUsuarioGS(email) {
  try {
    if (!_canManageUsuarios_()) return { success: false, error: "No autorizado" };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Usuarios');
    if (!sh) throw new Error("Hoja 'Usuarios' no encontrada");
    const values = sh.getDataRange().getValues();
    const headers = values[0].map(h => String(h).trim());
    const emailIdx = headers.indexOf('Email');
    if (emailIdx == -1) throw new Error("Encabezados inválidos");

    const rowIdx = values.findIndex(r => String(r[emailIdx]).toLowerCase() === String(email).toLowerCase());
    if (rowIdx <= 0) return { success: false, error: "Usuario no encontrado" };
    sh.deleteRow(rowIdx + 1);
    return { success: true, message: "Usuario eliminado correctamente" };
  } catch (e) {
    Logger.log("eliminarUsuarioGS: " + e.message);
    return { success: false, error: e.message };
  }
}