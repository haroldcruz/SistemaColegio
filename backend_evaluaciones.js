/**
 * backend_evaluaciones.js
 * Funciones GAS para módulo Evaluaciones (protegidas, MVC).
 *
 * Requiere:
 * - SPREADSHEET_ID definido en backend_main.js
 * - getUserRole(), getDataFromSheet(), getSeccionesData() ya presentes
 *
 * Hojas usadas:
 * - Evaluaciones
 * - Calificaciones
 * - TiposEvaluacion
 *
 * Notas:
 * - Asociación docente → materia validada contra hoja "CargaAcademica" (campo Email).
 * - Porcentajes por (id_materia + id_seccion + Ciclo) deben sumar ≤ 100.
 * - Escala de notas: 0-100, se guardan con 2 decimales.
 */

// -------------------------------------------------------------
// Helpers locales
// -------------------------------------------------------------
function _sheetByName_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

function _nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function _isDocenteOrAdmin_() {
  const u = getUserRole();
  const r = (u.role || '').toString().toLowerCase();
  return r === 'docente' || r === 'profesor' || r === 'administrador' || r === 'secretaria';
}

function _docenteAssignedTo_(email, id_materia, id_seccion) {
  // Busca en CargaAcademica una fila con Email=id && id_materia && id_seccion
  const rows = getDataFromSheet('CargaAcademica');
  return rows.some(r => {
    const e = (r.Email || '').toString().toLowerCase().trim();
    const m = (r.id_materia || '').toString().trim();
    const s = (r.id_seccion || '').toString().trim();
    return e === email.toLowerCase().trim() && String(m) === String(id_materia) && String(s) === String(id_seccion);
  });
}

function _readSheetRows_(sheetName) {
  try {
    return getDataFromSheet(sheetName);
  } catch (e) {
    return [];
  }
}

// -------------------------------------------------------------
// Listas para selects (filtradas por docente)
// -------------------------------------------------------------
function getEvaluationsLists() {
  const user = getUserRole();
  const userEmail = (user.email || '').toLowerCase().trim();

  // Tipos de evaluación (configurable)
  const tipos = _readSheetRows_('TiposEvaluacion').map(r => ({ id: r.id || r[0], label: r.label || r[1] || r[0] }));

  // Carga académica del docente -> materias y secciones asignadas
  const carga = _readSheetRows_('CargaAcademica');
  const my = carga.filter(r => (r.Email || '').toString().toLowerCase().trim() === userEmail);

  const materias = Array.from(new Map(my.map(r => [String(r.id_materia), { id_materia: r.id_materia, label: r.id_materia }]))).map(v => v[1]);
  const seccionesIds = [...new Set(my.map(r => String(r.id_seccion).trim()).filter(Boolean))];

  // Obtener secciones legibles
  const seccionesAll = getSeccionesData();
  const secciones = seccionesAll.filter(s => seccionesIds.includes(String(s.id_seccion)));
  const clases = _readSheetRows_('Clase'); // si aplica

  return { tiposEvaluacion: tipos, materiasDocente: materias, secciones, clases, docenteEmail: userEmail };
}

// -------------------------------------------------------------
// Obtener evaluaciones del docente (solo sus materias/secciones)
// -------------------------------------------------------------
function getEvaluacionesParaDocente() {
  const user = getUserRole();
  const userEmail = (user.email || '').toLowerCase().trim();
  const rows = _readSheetRows_('Evaluaciones');
  // Filtrar: creadas por el docente o asignadas a una materia/section donde docente aparece en CargaAcademica
  const carga = _readSheetRows_('CargaAcademica');

  const isAssigned = (id_materia, id_seccion) => {
    return carga.some(r => (r.Email || '').toString().toLowerCase().trim() === userEmail && String(r.id_materia) === String(id_materia) && String(r.id_seccion) === String(id_seccion));
  };

  const out = rows.filter(ev => {
    if (!ev) return false;
    // si fue creado por el docente, ok
    if ((ev.CreadoPorEmail || '').toString().toLowerCase().trim() === userEmail) return true;
    // si asignado y docente aparece en carga
    return isAssigned(ev.id_materia, ev.id_seccion);
  }).map(ev => {
    return {
      id_evaluacion: ev.id_evaluacion,
      id_materia: ev.id_materia,
      id_seccion: ev.id_seccion,
      id_clase: ev.id_clase,
      id_tipo_evaluacion: ev.id_tipo_evaluacion,
      TipoEvaluacionLabel: ev.TipoEvaluacionLabel,
      Fecha: ev.Fecha,
      PorcentajePonderado: ev.PorcentajePonderado,
      Descripcion: ev.Descripcion,
      CreadoPorEmail: ev.CreadoPorEmail,
      Ciclo: ev.Ciclo,
      Activo: ev.Activo
    };
  });

  return out;
}

// -------------------------------------------------------------
// Crear nueva evaluación (instrumento)
// payload: { id_materia, id_clase, id_seccion, id_tipo_evaluacion, Fecha, PorcentajePonderado, Descripcion, Ciclo }
// -------------------------------------------------------------
function crearEvaluacionGS(payload) {
  try {
    const user = getUserRole();
    const userEmail = (user.email || '').toString().toLowerCase().trim();
    if (!user || !userEmail) return { success: false, error: 'Usuario no identificado' };
    // solo docente/admin/secretaria pueden crear
    const r = (user.role || '').toString().toLowerCase();
    if (!(r === 'docente' || r === 'profesor' || r === 'administrador' || r === 'secretaria')) {
      return { success: false, error: 'No autorizado' };
    }
    // validación básica
    if (!payload || !payload.id_materia || !payload.id_seccion || !payload.id_tipo_evaluacion || !payload.PorcentajePonderado) {
      return { success: false, error: 'Faltan campos obligatorios' };
    }
    // validar asociación docente → materia
    if (!(r === 'administrador' || _docenteAssignedTo_(userEmail, payload.id_materia, payload.id_seccion))) {
      return { success: false, error: 'No estás asignado a esa materia/sección' };
    }

    // validar porcentaje suma ≤ 100 para la combinación materia+seccion+Ciclo
    const sheetE = _sheetByName_('Evaluaciones');
    const existing = _readSheetRows_('Evaluaciones').filter(e => String(e.id_materia) === String(payload.id_materia) && String(e.id_seccion) === String(payload.id_seccion) && String(e.Ciclo) === String(payload.Ciclo || ''));
    const sum = existing.reduce((s, x) => s + (Number(x.PorcentajePonderado) || 0), 0);
    const nuevo = Number(payload.PorcentajePonderado) || 0;
    if (sum + nuevo > 100 + 1e-9) {
      return { success: false, error: `Suma de porcentajes excede 100 (actual: ${sum})` };
    }

    // Generar id_evaluacion (EVAL + timestamp)
    const id_evaluacion = 'EVAL-' + (new Date()).getTime();
    const row = [
      id_evaluacion,
      payload.id_materia,
      payload.id_clase || '',
      payload.id_seccion,
      payload.id_tipo_evaluacion,
      payload.Fecha || '',
      payload.TipoEvaluacionLabel || '',
      Number(payload.PorcentajePonderado),
      payload.Descripcion || '',
      userEmail,
      payload.Ciclo || '',
      true,
      _nowIso_()
    ];
    // Asegurarse de hoja creada con encabezados apropiados; aquí appendRow
    sheetE.appendRow(row);
    return { success: true, message: 'Evaluación creada', id_evaluacion: id_evaluacion };
  } catch (e) {
    Logger.log('crearEvaluacionGS: ' + e.toString());
    return { success: false, error: e.message || e.toString() };
  }
}

// -------------------------------------------------------------
// Obtener detalles de una evaluación
// -------------------------------------------------------------
function getEvaluacionDetails(id_evaluacion) {
  const rows = _readSheetRows_('Evaluaciones');
  const ev = rows.find(r => String(r.id_evaluacion) === String(id_evaluacion));
  return ev || null;
}

// -------------------------------------------------------------
// Obtener estudiantes por sección (simple)
// -------------------------------------------------------------
function getStudentsBySection(id_seccion) {
  const students = _readSheetRows_('Estudiantes');
  return students.filter(s => String(s['Sección']) === String(id_seccion)).map(s => {
    return {
      Cedula: s['Cédula'] || s.Cédula || '',
      Nombre: [s.Nombre, s['Primer apellido'], s['Segundo apellido']].filter(Boolean).join(' ').trim()
    };
  });
}

// -------------------------------------------------------------
// Guardar calificaciones en bulk
// payload: array de { id_evaluacion, Cedula, Nombre, Nota, Observaciones }
// -------------------------------------------------------------
function guardarCalificacionesGS(rowsPayload) {
  try {
    const user = getUserRole();
    const userEmail = (user.email || '').toString().toLowerCase().trim();
    const r = (user.role || '').toString().toLowerCase();
    if (!(r === 'docente' || r === 'profesor' || r === 'administrador' || r === 'secretaria')) {
      return { success: false, error: 'No autorizado' };
    }
    if (!Array.isArray(rowsPayload) || rowsPayload.length === 0) return { success: false, error: 'No hay datos' };

    const sheetC = _sheetByName_('Calificaciones');
    if (!sheetC) throw new Error("Hoja 'Calificaciones' no encontrada");

    // Leer toda la hoja para upsert
    const existing = sheetC.getDataRange().getValues();
    const headers = existing[0] || [];
    // Map header positions
    const idx = {};
    headers.forEach((h, i) => idx[String(h).trim()] = i);
    // If headers do not match expected, treat as simple append with known order
    const rowsOut = existing.slice(1).map(rw => {
      const o = {};
      headers.forEach((h, i) => o[h] = rw[i]);
      return o;
    });

    const now = _nowIso_();

    // For each payload row: validate and upsert
    rowsPayload.forEach(p => {
      // Basic validations
      if (!p.id_evaluacion || !p.Cedula) throw new Error('Faltan campos en payload');
      const nota = Number(p.Nota);
      if (isNaN(nota) || nota < 0 || nota > 100) throw new Error('Nota fuera de rango (0-100)');

      // Authorization: check docente association for the evaluation
      const ev = getEvaluacionDetails(p.id_evaluacion);
      if (!ev) throw new Error('Evaluación no encontrada: ' + p.id_evaluacion);
      if (!(r === 'administrador' || _docenteAssignedTo_(userEmail, ev.id_materia, ev.id_seccion) || String(ev.CreadoPorEmail || '').toLowerCase() === userEmail)) {
        throw new Error('No autorizado para calificar esta evaluación');
      }

      // Upsert: find existing by id_evaluacion + Cedula
      const foundIndex = rowsOut.findIndex(x => String(x.id_evaluacion) === String(p.id_evaluacion) && String(x.Cedula) === String(p.Cedula));
      if (foundIndex !== -1) {
        // update in sheet: compute row number = foundIndex + 2
        const rowNum = foundIndex + 2;
        // find columns or append in fixed order if not present
        if (idx['Nota'] != null) sheetC.getRange(rowNum, idx['Nota']+1).setValue(Number(nota).toFixed(2));
        if (idx['Observaciones'] != null) sheetC.getRange(rowNum, idx['Observaciones']+1).setValue(p.Observaciones || '');
        if (idx['FechaCalificacion'] != null) sheetC.getRange(rowNum, idx['FechaCalificacion']+1).setValue(now);
        if (idx['CalificadoPorEmail'] != null) sheetC.getRange(rowNum, idx['CalificadoPorEmail']+1).setValue(userEmail);
      } else {
        // append new row with standard columns if headers unknown we append a safe order:
        // [id_calificacion,id_evaluacion,Cedula,Nombre,Nota,Observaciones,FechaCalificacion,CalificadoPorEmail]
        const id_cal = 'CAL-' + (new Date()).getTime() + '-' + Math.floor(Math.random()*1000);
        const newRow = [
          id_cal,
          p.id_evaluacion,
          p.Cedula,
          p.Nombre || '',
          Number(nota).toFixed(2),
          p.Observaciones || '',
          now,
          userEmail
        ];
        sheetC.appendRow(newRow);
      }
    });

    return { success: true, message: 'Calificaciones guardadas' };
  } catch (e) {
    Logger.log('guardarCalificacionesGS: ' + e.toString());
    return { success: false, error: e.message || e.toString() };
  }
}

// -------------------------------------------------------------
// Calcular resumen/Final para una sección+materia+ciclo
// - Devuelve array de { Cedula, Nombre, TotalPonderado } sin sobrescribir datos
// -------------------------------------------------------------
function calcularResumenFinalGS(id_seccion, id_materia, Ciclo) {
  try {
    // Leer evaluaciones y calificaciones relevantes
    const evs = _readSheetRows_('Evaluaciones').filter(e => String(e.id_seccion) === String(id_seccion) && String(e.id_materia) === String(id_materia) && String(e.Ciclo) === String(Ciclo));
    const cals = _readSheetRows_('Calificaciones');

    // Obtener lista de estudiantes de la sección
    const students = getStudentsBySection(id_seccion); // returns {Cedula,Nombre}

    // Mapear evaluaciones por id
    const evMap = {};
    evs.forEach(e => { evMap[String(e.id_evaluacion)] = Number(e.PorcentajePonderado) || 0; });

    const results = students.map(st => {
      // sumar (nota * %)/100 para todas las evaluaciones encontradas
      let total = 0;
      Object.keys(evMap).forEach(idEv => {
        const notaObj = cals.find(c => String(c.id_evaluacion) === String(idEv) && String(c.Cedula) === String(st.Cedula));
        if (notaObj && notaObj.Nota != null && notaObj.Nota !== '') {
          const n = Number(notaObj.Nota) || 0;
          const p = evMap[idEv];
          total += (n * p / 100);
        }
      });
      return { Cedula: st.Cedula, Nombre: st.Nombre, TotalPonderado: Number(total.toFixed(2)) };
    });

    return { success: true, resumen: results };
  } catch (e) {
    Logger.log('calcularResumenFinalGS: ' + e.toString());
    return { success: false, error: e.message || e.toString() };
  }
}