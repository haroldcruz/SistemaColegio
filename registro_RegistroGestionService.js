/**
 * @file RegistroGestionService.gs
 * @description Script del lado del servidor para el módulo de Registro Académico.
 * Contiene la lógica para importar, obtener, añadir, actualizar y eliminar datos de estudiantes.
 */

/**
 * Importa estudiantes desde un archivo de Google Sheets.
 * @param {string} fileId
 * @returns {object}
 */
function importarEstudiantes(fileId) {
  try {
    const email = Session.getActiveUser().getEmail();
    const usuario = obtenerUsuario(email);

    if (!usuario || usuario.rol !== 'Administrador') {
      return { success: false, message: 'Acceso denegado. Solo administradores pueden importar estudiantes.' };
    }

    const sourceSs = SpreadsheetApp.openById(fileId);
    const sourceSheet = sourceSs.getSheetByName('Estudiantes');
    if (!sourceSheet) {
      return { success: false, message: 'La hoja "Estudiantes" no se encontró en el archivo proporcionado.' };
    }

    const studentData = sourceSheet.getDataRange().getValues();
    if (studentData.length <= 1) {
      return { success: false, message: 'El archivo no contiene datos de estudiantes.' };
    }

    const destinationSs = SpreadsheetApp.openById('1qJ96eOOfNxegq7GF_GdoH92bTiQuLLX51G1SGf3NoHI');
    let destinationSheet = destinationSs.getSheetByName('Estudiantes');
    if (!destinationSheet) {
      destinationSheet = destinationSs.insertSheet('Estudiantes');
    }

    const lastRowDestination = destinationSheet.getLastRow();
    const dataToAppend = studentData.slice(1);
    const numRowsToAppend = dataToAppend.length;
    const numColsToAppend = dataToAppend[0] ? dataToAppend[0].length : 0;

    if (numRowsToAppend > 0 && numColsToAppend > 0) {
      destinationSheet.getRange(lastRowDestination + 1, 1, numRowsToAppend, numColsToAppend).setValues(dataToAppend);
      return { success: true, message: 'Importación de estudiantes completada exitosamente.' };
    } else {
      return { success: false, message: 'No hay datos válidos para importar.' };
    }
  } catch (error) {
    return { success: false, message: `Error durante la importación: ${error.message}` };
  }
}
