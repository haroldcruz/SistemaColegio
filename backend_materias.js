// backend_materias.js
// CRUD Materias (Hoja: "Materias") — columnas: id_materia | codigo | nombre

// ✅ Verifica permisos (Admin/Secretaria)
function _canManageMaterias_() {
  const u = getUserRole(); // ya existe en tu backend
  const r = (u.role || '').toLowerCase();
  return r === 'administrador' || r === 'secretaria';
}

// 🔹 READ: listar materias
function getMateriasData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Materias');
    if (!sh) throw new Error("Hoja 'Materias' no encontrada");

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return [];

    const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0].map(h => String(h).trim());
    const idIdx = headers.indexOf('id_materia');
    const codIdx = headers.indexOf('codigo');
    const nomIdx = headers.indexOf('nombre');
    if (idIdx === -1 || codIdx === -1 || nomIdx === -1) throw new Error('Encabezados inválidos');

    return data.slice(1)
      .filter(r => r[idIdx]) // ignora filas vacías
      .map(r => ({
        id_materia: r[idIdx],
        codigo: r[codIdx] || '',
        nombre: r[nomIdx] || ''
      }));
  } catch (e) {
    Logger.log('getMateriasData: ' + e.message);
    return [];
  }
}

// 🔹 CREATE: agregar materia (ID auto: MAT01, MAT02, …)
function agregarMateriaGS(data) {
  try {
    if (!_canManageMaterias_()) return { success: false, error: 'No autorizado' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Materias');
    if (!sh) throw new Error("Hoja 'Materias' no encontrada");

    const exist = getMateriasData();
    // nuevo correlativo a partir del mayor MAT##
    const nextNum = exist.length > 0
      ? Math.max(...exist.map(m => parseInt(String(m.id_materia).replace(/\D/g, '') || '0', 10))) + 1
      : 1;
    const newId = 'MAT' + String(nextNum).padStart(2, '0');

    // validación simple de duplicados por código o nombre
    const dup = exist.some(m =>
      String(m.codigo).toLowerCase() === String(data.codigo).toLowerCase() ||
      String(m.nombre).toLowerCase() === String(data.nombre).toLowerCase()
    );
    if (dup) return { success: false, error: 'Materia duplicada (código o nombre)' };

    sh.appendRow([newId, data.codigo, data.nombre]);
    return { success: true, message: 'Materia agregada correctamente', id: newId };
  } catch (e) {
    Logger.log('agregarMateriaGS: ' + e.message);
    return { success: false, error: e.message };
  }
}

// 🔹 UPDATE: editar materia
function editarMateriaGS(data) {
  try {
    if (!_canManageMaterias_()) return { success: false, error: 'No autorizado' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Materias');
    if (!sh) throw new Error("Hoja 'Materias' no encontrada");

    const values = sh.getDataRange().getValues();
    const headers = values[0].map(h => String(h).trim());
    const idIdx = headers.indexOf('id_materia');
    const codIdx = headers.indexOf('codigo');
    const nomIdx = headers.indexOf('nombre');
    if (idIdx === -1 || codIdx === -1 || nomIdx === -1) throw new Error('Encabezados inválidos');

    const rowIdx = values.findIndex(r => String(r[idIdx]) === String(data.id_materia));
    if (rowIdx <= 0) return { success: false, error: 'Materia no encontrada' };

    sh.getRange(rowIdx + 1, codIdx + 1).setValue(data.codigo);
    sh.getRange(rowIdx + 1, nomIdx + 1).setValue(data.nombre);
    return { success: true, message: 'Materia actualizada correctamente' };
  } catch (e) {
    Logger.log('editarMateriaGS: ' + e.message);
    return { success: false, error: e.message };
  }
}

// 🔹 DELETE: eliminar materia
function eliminarMateriaGS(id_materia) {
  try {
    if (!_canManageMaterias_()) return { success: false, error: 'No autorizado' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Materias');
    if (!sh) throw new Error("Hoja 'Materias' no encontrada");

    const values = sh.getDataRange().getValues();
    const headers = values[0].map(h => String(h).trim());
    const idIdx = headers.indexOf('id_materia');
    if (idIdx === -1) throw new Error('Encabezados inválidos');

    const rowIdx = values.findIndex(r => String(r[idIdx]) === String(id_materia));
    if (rowIdx <= 0) return { success: false, error: 'Materia no encontrada' };

    sh.deleteRow(rowIdx + 1);
    return { success: true, message: 'Materia eliminada correctamente' };
  } catch (e) {
    Logger.log('eliminarMateriaGS: ' + e.message);
    return { success: false, error: e.message };
  }
}
