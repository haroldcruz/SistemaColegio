// Obtiene todas las secciones con sus columnas reales
function getSeccionesData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Secciones');
    if (!sheet) throw new Error("Hoja 'Secciones' no encontrada");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const idIndex = headers.indexOf("id_seccion");
    const nivelIndex = headers.indexOf("Nivel");
    const grupoIndex = headers.indexOf("Grupo");
    const subgrupoIndex = headers.indexOf("Subgrupo");

    return data.slice(1).map(row => ({
      id_seccion: row[idIndex],
      Nivel: row[nivelIndex],
      Grupo: row[grupoIndex],
      Subgrupo: row[subgrupoIndex]
    })).filter(s => s.id_seccion);
  } catch (e) {
    Logger.log("Error en getSeccionesData: " + e.message);
    return [];
  }
}

// =============================================================
// CRUD COMPLETO PARA LA HOJA "Secciones"
// =============================================================

// 🔹 READ: obtener todas las secciones (optimizada)
function getSeccionesData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Secciones');
    if (!sheet) throw new Error("Hoja 'Secciones' no encontrada");

    // Solo lee el rango con datos reales
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return []; // sin registros

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0];
    const idIndex = headers.indexOf("id_seccion");
    const nivelIndex = headers.indexOf("Nivel");
    const grupoIndex = headers.indexOf("Grupo");
    const subgrupoIndex = headers.indexOf("Subgrupo");

    if (idIndex === -1) throw new Error("Encabezados incorrectos");

    // Devuelve solo filas válidas
    return data.slice(1)
      .filter(r => r[idIndex]) // descarta filas vacías
      .map(r => ({
        id_seccion: r[idIndex],
        Nivel: r[nivelIndex] || "",
        Grupo: r[grupoIndex] || "",
        Subgrupo: r[subgrupoIndex] || ""
      }));

  } catch (e) {
    Logger.log("Error en getSeccionesData: " + e.message);
    return [];
  }
}


// 🔹 CREATE: agregar nueva sección
function agregarSeccionGS(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Secciones');
    if (!sheet) throw new Error("Hoja 'Secciones' no encontrada");

    const secciones = getSeccionesData();
    const existe = secciones.some(s =>
      String(s.Nivel) === String(data.Nivel) &&
      String(s.Grupo) === String(data.Grupo) &&
      String(s.Subgrupo) === String(data.Subgrupo)
    );
    if (existe) return { success: false, error: "Esa sección ya existe" };

    // Asigna nuevo ID autoincremental
    const nuevoId = secciones.length > 0
      ? Math.max(...secciones.map(s => Number(s.id_seccion))) + 1
      : 1;

    sheet.appendRow([nuevoId, data.Nivel, data.Grupo, data.Subgrupo]);
    return { success: true, message: "Sección agregada correctamente" };
  } catch (err) {
    Logger.log("Error en agregarSeccionGS: " + err.message);
    return { success: false, error: err.message };
  }
}

// 🔹 UPDATE: editar sección existente
function editarSeccionGS(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Secciones');
    if (!sheet) throw new Error("Hoja 'Secciones' no encontrada");

    const dataAll = sheet.getDataRange().getValues();
    const headers = dataAll[0];
    const idIndex = headers.indexOf("id_seccion");
    const nivelIndex = headers.indexOf("Nivel");
    const grupoIndex = headers.indexOf("Grupo");
    const subgrupoIndex = headers.indexOf("Subgrupo");

    const rowIndex = dataAll.findIndex(r => String(r[idIndex]) === String(data.id_seccion));
    if (rowIndex === -1) return { success: false, error: "Sección no encontrada" };

    // Actualiza la fila
    sheet.getRange(rowIndex + 1, nivelIndex + 1).setValue(data.Nivel);
    sheet.getRange(rowIndex + 1, grupoIndex + 1).setValue(data.Grupo);
    sheet.getRange(rowIndex + 1, subgrupoIndex + 1).setValue(data.Subgrupo);

    return { success: true, message: "Sección actualizada correctamente" };
  } catch (err) {
    Logger.log("Error en editarSeccionGS: " + err.message);
    return { success: false, error: err.message };
  }
}

// 🔹 DELETE: eliminar sección por ID
function eliminarSeccionGS(id) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Secciones');
    if (!sheet) throw new Error("Hoja 'Secciones' no encontrada");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf("id_seccion");

    const rowIndex = data.findIndex(r => String(r[idIndex]) === String(id));
    if (rowIndex <= 0) return { success: false, error: "Sección no encontrada" };

    sheet.deleteRow(rowIndex + 1);
    return { success: true, message: "Sección eliminada correctamente" };
  } catch (err) {
    Logger.log("Error en eliminarSeccionGS: " + err.message);
    return { success: false, error: err.message };
  }
}
