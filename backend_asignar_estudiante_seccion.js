// Backend: asignarEstudianteASeccion
// Protegido: solo 'administrador' o 'secretaria' pueden ejecutar.
// Busca estudiante por cédula o email y actualiza su campo Sección en la hoja "Estudiantes".

function asignarEstudianteASeccion(payload) {
  try {
    // payload: { cedula?, email?, nuevaSeccion, motivo? }
    const user = getUserRole();
    const role = (user.role || '').toString().toLowerCase();
    if (!(role === 'administrador' || role === 'secretaria')) {
      return { success:false, error: 'No autorizado' };
    }
    if (!payload || !payload.nuevaSeccion) {
      return { success:false, error: 'Falta nuevaSeccion' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Estudiantes');
    if (!sh) return { success:false, error: "Hoja 'Estudiantes' no encontrada" };

    const values = sh.getDataRange().getValues();
    if (values.length < 1) return { success:false, error: 'Hoja vacía' };

    const headers = values[0].map(h => String(h).trim());

    // Normaliza posibles nombres de columnas
    const colNames = {
      cedula: headers.findIndex(h => /c[eé]dula/i.test(h)),
      email: headers.findIndex(h => /correo|email/i.test(h)),
      seccion: headers.findIndex(h => /secci[oó]n|seccion/i.test(h))
    };

    if (colNames.seccion === -1) return { success:false, error: "Columna 'Sección' no encontrada" };

    // Busca fila por cedula o email según lo provisto
    let rowIdx = -1;
    if (payload.cedula) {
      const ced = String(payload.cedula).toLowerCase().trim();
      if (colNames.cedula !== -1) {
        rowIdx = values.findIndex((r, i) => i>0 && String(r[colNames.cedula]).toLowerCase().trim() === ced);
      }
    }
    if (rowIdx === -1 && payload.email) {
      const mail = String(payload.email).toLowerCase().trim();
      if (colNames.email !== -1) {
        rowIdx = values.findIndex((r, i) => i>0 && String(r[colNames.email]).toLowerCase().trim() === mail);
      }
    }

    if (rowIdx <= 0) {
      return { success:false, error: 'Estudiante no encontrado' };
    }

    // Antes de escribir: opcional confirmar valor anterior
    const oldVal = values[rowIdx][colNames.seccion];

    // Escribe nueva sección (columna es 1-based, filas también)
    sh.getRange(rowIdx+1, colNames.seccion+1).setValue(payload.nuevaSeccion);

    // Opcional: no se crea log (según confirmación del usuario)
    return {
      success: true,
      message: `Sección actualizada (${oldVal || 'anterior: N/A'} → ${payload.nuevaSeccion})`
    };
  } catch (e) {
    Logger.log('asignarEstudianteASeccion: ' + e.toString());
    return { success:false, error: e.message || e.toString() };
  }
}