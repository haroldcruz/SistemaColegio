// estrae estudiantes filtrados por rol
function getStudentsData(usuarioLogueado) {
  try {
    // Extraer datos relevantes del usuario logueado
    const role = usuarioLogueado.role ? usuarioLogueado.role.toString().toLowerCase().trim() : '';
    const email = usuarioLogueado.email ? usuarioLogueado.email.toLowerCase().trim() : '';
    // Lee la hoja de Encargados, no de Estudiantes
    const encargados = getDataFromSheet('Encargados');
    // Busca el encargado por correo
    const encargado = encargados.find(e => e["Correo"].toLowerCase().trim() === usuarioLogueado.email.toLowerCase().trim());
    // Extrae el ID
    const encargadoId = encargado ? encargado["ID"] : "";
    //debería ser así: const acceso = usuarioLogueado.accesos ? usuarioLogueado.accesos.toString().trim() : '';
    const acceso = usuarioLogueado.encargadoId ? usuarioLogueado.encargadoId.toString().trim() : '';

    // Leer todos los estudiantes desde la base de datos/hoja
    const studentsRaw = getDataFromSheet('Estudiantes');

    // Normaliza cada estudiante a objeto plano (solo strings/números)
    const students = studentsRaw.map(s => {
      const obj = {};
      for (let key in s) {
        // Convierte todo a string, nunca undefined ni objeto especial
        obj[key] = (typeof s[key] === 'undefined' || s[key] === null) ? '' : s[key].toString();
      }
      return obj;
    });

    // Administrador y secretaria: acceso total
    if (role === 'administrador' || role === 'secretaria') {
      return students;
    }

    // Docente/profesor: filtrar por secciones en acceso (id_seccion)
    if (role === 'docente' || role === 'profesor') {
      // Extrae IDs de secciones del acceso
      const seccionesAcceso = acceso.split(',').map(x => x.trim()).filter(x => x);
      // Filtra estudiantes por Sección
      const filtrados = students.filter(s => seccionesAcceso.includes(s['Sección'])); // <-- usa id_seccion
      return filtrados;
    }

    // Encargado/padre: filtrar por Encargado ID
    if (role === 'encargado' || role === 'padre') {
      // Solo mostrar estudiantes que tienen su Encargado ID
      const sEncIdKeys = ["Encargado ID", "Encargado_ID", "EncargadoId"];
      return students.filter(s => {
        const sEncId = sEncIdKeys.map(k => s[k]).find(id => id);
        return sEncId && sEncId === encargadoId;
      });
    }

    // Otros roles: sin acceso
    return [];
  } catch (err) {
    Logger.log("Error en getStudentsData: " + err);
    return [];
  }
}
// GAS: Recibe array de estudiantes, valida rol y guarda en hoja
function importacionEstudianteGS(JsonEstudiante) {
  const usuario = getUserRole();
  if (!usuario || usuario.role.toLowerCase() !== 'administrador') {
    return [{ estado: 'rechazado', motivo: 'No autorizado' }];
  }
  // Accede a la hoja correctamente
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Estudiantes');
  if (!sheet) {
    return [{ estado: 'rechazado', motivo: 'Hoja "Estudiantes" no encontrada' }];
  }
  const resultado = [];
  JsonEstudiante.forEach(e => {
    // Validar campos obligatorios
    if (!e.Cédula || !e.Nombre) {
      resultado.push({ estado: 'rechazado', cedula: e.Cédula, motivo: 'Campos obligatorios' });
      return;
    }
    // Añadir fila
    sheet.appendRow([
      e.Cédula,
      e['Primer apellido'],
      e['Segundo apellido'],
      e.Nombre,
      e.Nacionalidad,
      e.Sexo,
      e['Fecha de nacimiento'],
      e.Sección,
      e['Encargado ID'],
      e.Teléfono
    ]);
    resultado.push({ estado: 'insertado', cedula: e.Cédula });
  });
  return resultado;
}
/**
 * Obtiene todos los datos de un estudiante por cédula de Google Sheets.
 * Incluye datos personales, sección, materias, ausencias (por materia y estado), conducta, comportamiento.
 * @param {string} cedula
 * @returns {object} datos del estudiante
 */
// --- Convierte objetos o arrays a texto legible ---
function convertirLegible(obj) {
  if (obj == null) return '';
  if (typeof obj !== 'object') return String(obj);

  let texto = '';
  for (let key in obj) {
    const val = obj[key];
    if (typeof val === 'object' && val !== null) {
      // Mostrar subniveles con sangría
      texto += `${key}:\n`;
      for (let sub in val) {
        texto += `  ${sub}: ${val[sub]}\n`;
      }
    } else {
      texto += `${key}: ${val}\n`;
    }
  }
  return texto.trim();
}


function getStudentDetails(cedula) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usuarios = getDataFromSheet('Usuarios', ss);
  const estudiantes = getDataFromSheet('Estudiantes', ss);
  const secciones = getDataFromSheet('Secciones', ss);
  const materias = getDataFromSheet('Materias', ss);
  const clase = getDataFromSheet('Clase', ss);
  const ausencias = getDataFromSheet('Ausencias', ss);
  const conducta = getDataFromSheet('Conducta', ss);
  const comportamiento = getDataFromSheet('comportamiento', ss);

  // Calificaciones
  const califSheet = ss.getSheetByName('Calificaciones');
  const califData = califSheet.getDataRange().getValues();
  const califHeaders = califData[0];
  const calificaciones = califData.slice(1).map(row => {
    const obj = {};
    califHeaders.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // Datos estudiante
  const personal = estudiantes.find(e => e['Cédula'] === cedula) || {};
  const seccion = secciones.find(s => s['id_seccion'] === personal['Sección']) || {};
  const clasesSeccion = clase.filter(c => c['id_seccion'] === personal['Sección']);
  const materiasCursando = clasesSeccion.map(c => {
    const mat = materias.find(m => m['id_materia'] === c['id_materia']) || {};
    return mat;
  });
// --- Agrupar ausencias por materia y tipo ---
const ausenciasEst = ausencias.filter(a => a['Cédula'] === cedula);
const ausenciasPorMateria = {};

ausenciasEst.forEach(a => {
  // Buscar la materia según el id_clase
  const claseObj = clase.find(c => c['id_clase'] === a['id_clase']);
  const materiaObj = materias.find(m => m['id_materia'] === claseObj?.['id_materia']);
  const nombreMateria = materiaObj ? (materiaObj['nombre'] || materiaObj['id_materia']) : 'Sin materia';
  const estado = a['Estado'] || 'Sin estado';

  // Inicializar estructura si no existe
  if (!ausenciasPorMateria[nombreMateria]) ausenciasPorMateria[nombreMateria] = { Justificada: 0, Injustificada: 0 };

  // Contar por tipo
  if (estado === 'Justificada') ausenciasPorMateria[nombreMateria].Justificada++;
  else if (estado === 'Injustificada') ausenciasPorMateria[nombreMateria].Injustificada++;
});

  const conductaEst = conducta.filter(c => c['Cédula estudiante'] === cedula);
  const comportamientoEst = comportamiento.filter(c => c['Cédula'] === cedula);
  const califEst = calificaciones.filter(c => c['Id_Alumno'] === cedula);
  // Incluye nombre y correo docente en cada clase
  const clasesSeccionConDocente = clasesSeccion.map(claseObj => {
    const docente = usuarios.find(u => u.Email === claseObj.id_profesor) || {};
    return {
      ...claseObj,
      nombre_docente: docente.Nombre || "",
      correo_docente: docente.Email || ""
    };
  });

  // Backend: getStudentDetails debe retornar ambos bloques
  return {
    datosArr: [
      { tipo: "personal", datos: convertirLegible(personal) },
      { tipo: "seccion", datos: convertirLegible(seccion) },
      { tipo: "materias", datos: materiasCursando.map(convertirLegible) },
      { tipo: "clase", datos: clasesSeccionConDocente.map(convertirLegible) },
      { tipo: "ausencias", datos: convertirLegible(ausenciasPorMateria) },
      { tipo: "conducta", datos: conductaEst.map(convertirLegible) },
      { tipo: "comportamiento", datos: comportamientoEst.map(convertirLegible) },
      { tipo: "calificaciones", datos: califEst.map(convertirLegible) }
    ],
    usuariosArr: usuarios
  };
}
// para la funcio editar
function convertirJSON(est) {
  const copia = { ...est };
  if (copia['Fecha de nacimiento'] instanceof Date) {
    copia['Fecha de nacimiento'] = Utilities.formatDate(
      copia['Fecha de nacimiento'],
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }
  return copia;
}

// Retorna solo la información del estudiante para edición (sin procesar otras hojas)
function getStudentEditData(cedula) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const estudiantes = getDataFromSheet('Estudiantes', ss);
  const estudiante = estudiantes.find(e => String(e['Cédula']) === String(cedula));

  if (!estudiante) return null;

  // Convierte fechas y asegura que todo sea serializable
  const estudianteLegible = convertirJSON(estudiante);
  return {
    datosArr: [
      { tipo: "personal", datos: estudianteLegible }
    ]
  };
}
// Guarda los datos editados de un estudiante y gestiona los accesos de encargados
function guardarDatosEstudiante(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const estudiantesSheet = ss.getSheetByName('Estudiantes');
    const encargadosSheet = ss.getSheetByName('Encargados');
    const usuariosSheet = ss.getSheetByName('Usuarios');

    // Busca fila del estudiante
    const estudiantes = getDataFromSheet('Estudiantes', ss);
    const idx = estudiantes.findIndex(e => String(e['Cédula']) === String(data.cedula));
    if (idx === -1) return { success: false, error: 'Estudiante no encontrado' };

    const estudianteAnterior = estudiantes[idx];
    const encargadoAnterior = estudianteAnterior['Encargado ID'];
    const encargadoNuevo = data.encargado_id || data.encargadoId;

    // Si cambia el encargado, gestiona accesos
    if (encargadoAnterior !== encargadoNuevo) {

      // Busca correo de encargado anterior
      const encargadoAntObj = getDataFromSheet('Encargados', ss).find(e => e['ID'] === encargadoAnterior);
      const encargadoNuevoObj = getDataFromSheet('Encargados', ss).find(e => e['ID'] === encargadoNuevo);
      if (!encargadoAntObj || !encargadoNuevoObj) return { success: false, error: 'Encargado no encontrado' };

      const correoAnterior = encargadoAntObj['Correo'];
      const correoNuevo = encargadoNuevoObj['Correo'];

      // Actualiza columna Acceso en Usuarios
      actualizarAccesoUsuario(usuariosSheet, correoAnterior, data.cedula, 'eliminar');
      actualizarAccesoUsuario(usuariosSheet, correoNuevo, data.cedula, 'agregar');
    }

    // Actualiza los datos del estudiante
    const headers = estudiantesSheet.getDataRange().getValues()[0];
    const row = idx + 2;
    estudiantesSheet.getRange(row, headers.indexOf('Nombre') + 1).setValue(data.nombre);
    estudiantesSheet.getRange(row, headers.indexOf('Primer apellido') + 1).setValue(data.primer_apellido);
    estudiantesSheet.getRange(row, headers.indexOf('Segundo apellido') + 1).setValue(data.segundo_apellido);
    estudiantesSheet.getRange(row, headers.indexOf('Sección') + 1).setValue(data.seccion);
    estudiantesSheet.getRange(row, headers.indexOf('Nacionalidad') + 1).setValue(data.nacionalidad);
    estudiantesSheet.getRange(row, headers.indexOf('Sexo') + 1).setValue(data.sexo);
    estudiantesSheet.getRange(row, headers.indexOf('Fecha de nacimiento') + 1).setValue(data.nacimiento);
    estudiantesSheet.getRange(row, headers.indexOf('Teléfono') + 1).setValue(data.telefono);
    estudiantesSheet.getRange(row, headers.indexOf('Encargado ID') + 1).setValue(encargadoNuevo);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
/**
 * Guarda un nuevo estudiante y asigna su acceso al encargado correspondiente.
 * - Valida duplicados por Cédula.
 * - Inserta los datos en la hoja "Estudiantes".
 * - Actualiza accesos del encargado en la hoja "Usuarios".
 * - Devuelve un objeto de estado al frontend.
 */
  function guardarNuevoEstudianteGS(data) {
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const estudiantesSheet = ss.getSheetByName('Estudiantes');
      const encargadosSheet = ss.getSheetByName('Encargados');
      const usuariosSheet = ss.getSheetByName('Usuarios');

      if (!estudiantesSheet || !encargadosSheet || !usuariosSheet) {
        throw new Error('Una o más hojas no se encontraron');
      }

      // 1️⃣ Validar duplicados por cédula
      const estudiantes = getDataFromSheet('Estudiantes', ss);
      const existe = estudiantes.some(e => String(e['Cédula']) === String(data.cedula));
      if (existe) {
        return { success: false, error: 'La cédula ya existe en la base de datos' };
      }

      // 2️⃣ Buscar encargado en la hoja "Encargados"
      const encargados = getDataFromSheet('Encargados', ss);
      const encargado = encargados.find(e => String(e['ID']) === String(data.encargado_id));
      if (!encargado) {
        return { success: false, error: 'Encargado no encontrado' };
      }

      const correoEncargado = encargado['Correo'];
      if (!correoEncargado) {
        return { success: false, error: 'Encargado sin correo registrado' };
      }

      // 3️⃣ Insertar nuevo estudiante en la hoja
      const nuevaFila = [
        data.cedula || '',
        data.primer_apellido || '',
        data.segundo_apellido || '',
        data.nombre || '',
        data.nacionalidad || '',
        data.sexo || '',
        data.nacimiento || '',
        data.seccion || '',
        data.encargado_id || '',
        data.telefono || ''
      ];
      estudiantesSheet.appendRow(nuevaFila);

      // 4️⃣ Asignar el acceso al encargado (agregar la cédula en Usuarios)
      actualizarAccesoUsuario(usuariosSheet, correoEncargado, data.cedula, 'agregar');

      // 5️⃣ Respuesta al frontend
      return { success: true, message: 'Estudiante agregado correctamente' };

    } catch (err) {
      Logger.log('Error en guardarNuevoEstudianteGS: ' + err.message);
      return { success: false, error: err.message };
    }
  }
/**
 * Elimina al estudiante y todos sus registros asociados.
 * Además, elimina la relación con su encargado en la hoja Usuarios.
 * @param {string} cedula - Cédula del estudiante a eliminar.
 * @return {Object} Resultado del proceso.
 */
function eliminarEstudianteGS(cedula) {
  try {
    // 1️⃣ Validaciones iniciales
    if (!cedula) return { success: false, error: 'Cédula no recibida.' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const estudiantesSheet = ss.getSheetByName('Estudiantes');
    const encargadosSheet  = ss.getSheetByName('Encargados');
    const usuariosSheet    = ss.getSheetByName('Usuarios');

    if (!estudiantesSheet || !encargadosSheet || !usuariosSheet) {
      throw new Error('Una o más hojas requeridas no se encontraron.');
    }

    // 2️⃣ Buscar estudiante en la hoja Estudiantes
    const estudiantes = getDataFromSheet('Estudiantes', ss);
    const idx = estudiantes.findIndex(e => String(e['Cédula']).trim() === String(cedula).trim());
    if (idx === -1) return { success: false, error: 'Estudiante no encontrado.' };

    const estudiante = estudiantes[idx];
    const encargadoId = estudiante['Encargado ID'];

    // 3️⃣ Buscar correo del encargado si existe
    let correoEncargado = '';
    if (encargadoId) {
      const encargados = getDataFromSheet('Encargados', ss);
      const encargado = encargados.find(e => String(e['ID']).trim() === String(encargadoId).trim());
      correoEncargado = encargado ? (encargado['Correo'] || '') : '';
    }

    // 4️⃣ Eliminar fila del estudiante en hoja Estudiantes
    const data = estudiantesSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const colCed = headers.findIndex(h => ['cédula','cedula','identificacion','id'].includes(h));
    if (colCed === -1) throw new Error('No se encontró columna de cédula.');
    let filaEliminar = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][colCed]).trim() === String(cedula).trim()) {
        filaEliminar = i + 1;
        break;
      }
    }
    if (filaEliminar === -1) throw new Error('Fila del estudiante no encontrada.');
    estudiantesSheet.deleteRow(filaEliminar);

    // 5️⃣ Desligar acceso del encargado en Usuarios
    if (correoEncargado)
      actualizarAccesoUsuario(usuariosSheet, correoEncargado, cedula, 'eliminar');

    // 6️⃣ Eliminar registros en hojas relacionadas
    const hojasAsociadas = ['Secciones','Evaluaciones','Calificaciones','Conducta','Comportamiento','Ausencias'];
    hojasAsociadas.forEach(nombre => {
      const h = ss.getSheetByName(nombre);
      if (!h) return;
      const vals = h.getDataRange().getValues();
      if (vals.length < 2) return;
      const cab = vals[0].map(x => String(x).trim().toLowerCase());
      const col = cab.findIndex(x => ['cédula','cedula','identificacion','id'].includes(x));
      if (col === -1) return;
      for (let i = vals.length - 1; i >= 1; i--) {
        if (String(vals[i][col]).trim() === String(cedula).trim()) {
          h.deleteRow(i + 1);
        }
      }
    });

    // 7️⃣ Resultado
    return {
      success: true,
      message: 'Estudiante eliminado y relación con encargado removida correctamente.'
    };

  } catch (err) {
    Logger.log('Error en eliminarEstudianteGS: ' + err.message);
    return { success: false, error: err.message };
  }
}




