// BACKEND CARGA ACADÉMICA (corregido)
// - Ajuste principal: COLS ahora respeta el orden real de la hoja (incluye id_clase).
// - Se añadieron validaciones de rol (MVC) en operaciones de escritura (solo admin/secretaria).
// - Comentarios breves incluidos según petición.

const SHEET_CARGA = 'CargaAcademica';
// columnas en la hoja CargaAcademica: respetar exactamente el orden de la hoja
const COLS = ['Email', 'id_materia', 'id_clase', 'id_seccion', 'Ciclo', 'TipoAsignacion'];

// -------------------------------------------------------------
// Helpers de acceso a Spreadsheet
// -------------------------------------------------------------
function ss_() { 
  return SpreadsheetApp.openById(SPREADSHEET_ID); 
}

function cargaSh_() {
  const sh = ss_().getSheetByName(SHEET_CARGA);
  if (!sh) throw new Error('No se encontró la hoja "CargaAcademica"');
  return sh;
}

// -------------------------------------------------------------
// Mapas de referencia (usuarios, materias, secciones)
// -------------------------------------------------------------
function mapUsuarios_() {
  const sh = ss_().getSheetByName('Usuarios');
  if (!sh) return {};
  const v = sh.getDataRange().getValues();
  const head = v[0].map(String);
  const iEmail = head.indexOf('Email');
  const iNombre = head.indexOf('Nombre');
  const out = {};
  for (let i = 1; i < v.length; i++) {
    const e = (v[i][iEmail] || '').toString().trim();
    const n = (v[i][iNombre] || '').toString().trim();
    if (e) out[e] = n || e;
  }
  return out;
}

function mapMaterias_() {
  const sh = ss_().getSheetByName('Materias');
  if (!sh) return {};
  const v = sh.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < v.length; i++) {
    const id = (v[i][0] || '').toString().trim();
    const nom = (v[i][1] || '').toString().trim();
    if (id) out[id] = nom ? (id + ' — ' + nom) : id;
  }
  return out;
}

function mapSecciones_() {
  const sh = ss_().getSheetByName('Secciones');
  if (!sh) return {};
  const v = sh.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < v.length; i++) {
    const id = (v[i][0] || '').toString().trim();
    const nivel = (v[i][1] || '').toString().trim();
    const grupo = (v[i][2] || '').toString().trim();
    const sub = (v[i][3] || '').toString().trim();
    const nombre = [nivel, grupo, sub].filter(Boolean).join(' - ');
    if (id) out[id] = nombre || id;
  }
  return out;
}

// -------------------------------------------------------------
// Ciclo actual desde ConfiguracionesGenerales
// -------------------------------------------------------------
function cicloActual_() {
  const sh = ss_().getSheetByName('ConfiguracionesGenerales');
  if (!sh) return '';
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return '';
  const headers = data[0].map(h => (h || '').toString().trim().toLowerCase());
  const iAno = headers.indexOf('anolectivo');
  const iPer = headers.indexOf('periodolectivo');
  if (iAno === -1 || iPer === -1) return '';
  const ano = (data[1][iAno] || '').toString().trim();
  const per = (data[1][iPer] || '').toString().trim();
  return (ano && per) ? `${ano}-${per}` : '';
}

// -------------------------------------------------------------
// Obtener todos los registros con nombres enriquecidos
// -------------------------------------------------------------
function getCargaAcademicaData() {
  const sh = cargaSh_();
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const head = vals[0].map(String);
  const idx = Object.fromEntries(COLS.map(c => [c, head.indexOf(c)]));

  const mapU = mapUsuarios_();
  const mapM = mapMaterias_();
  const mapS = mapSecciones_();

  const out = [];
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    const row = {};
    // asigna cada columna según encabezado detectado (respetando COLS)
    COLS.forEach(c => row[c] = r[idx[c]]);
    // enriquecimiento para frontend
    row.DocenteNombre = mapU[(row.Email || '').toString().trim()] || row.Email || '';
    row.MateriaNombre = mapM[(row.id_materia || '').toString().trim()] || row.id_materia || '';
    row.SeccionNombre = mapS[(row.id_seccion || '').toString().trim()] || row.id_seccion || '';
    out.push(row);
  }
  return out;
}

// -------------------------------------------------------------
// Verifica rol (solo admin o secretaria)
// -------------------------------------------------------------
function _canManageCarga_() {
  const u = getUserRole();
  const r = (u.role || '').toString().toLowerCase();
  return r === 'administrador' || r === 'secretaria';
}

// -------------------------------------------------------------
// Agregar nueva carga académica (protegido)
// -------------------------------------------------------------
function agregarCargaAcademicaGS(p) {
  try {
    if (!_canManageCarga_()) return { success: false, error: 'No autorizado' };
    // Validaciones mínimas
    if (!p || !p.Email || !p.id_materia || !p.id_seccion || !p.Ciclo) {
      return { success: false, error: 'Faltan campos obligatorios' };
    }
    const sh = cargaSh_();
    const dup = findRowIndexByKey_(sh, p.Email, p.id_seccion, p.Ciclo);
    if (dup > 0) return { success: false, success:false, message: 'Asignación duplicada' };
    // Escribe fila en el orden COLS
    const row = COLS.map(k => (typeof p[k] !== 'undefined' ? p[k] : ''));
    sh.appendRow(row);
    return { success: true, message: 'Asignación agregada' };
  } catch (e) {
    Logger.log('agregarCargaAcademicaGS: ' + e.toString());
    return { success: false, error: e.message || e.toString() };
  }
}

// -------------------------------------------------------------
// Editar una carga académica (protegido)
// -------------------------------------------------------------
function editarCargaAcademicaGS(p) {
  try {
    if (!_canManageCarga_()) return { success: false, error: 'No autorizado' };
    if (!p || !p._originalKey) return { success: false, error: 'Faltan datos' };
    const sh = cargaSh_();
    const k = p._originalKey || {};
    const idx = findRowIndexByKey_(sh, k.Email, k.id_seccion, k.Ciclo);
    if (idx <= 0) return { success: false, message: 'No existe el registro original' };

    const movioClave = (p.Email !== k.Email) || (p.id_seccion !== k.id_seccion) || (p.Ciclo !== k.Ciclo);
    if (movioClave) {
      const dup = findRowIndexByKey_(sh, p.Email, p.id_seccion, p.Ciclo);
      if (dup > 0 && dup !== idx) return { success: false, message: 'La nueva clave ya existe' };
    }

    // Actualiza la fila completa respetando COLS
    const row = COLS.map(c => (typeof p[c] !== 'undefined' ? p[c] : ''));
    sh.getRange(idx, 1, 1, COLS.length).setValues([row]);
    return { success: true, message: 'Asignación actualizada' };
  } catch (e) {
    Logger.log('editarCargaAcademicaGS: ' + e.toString());
    return { success: false, error: e.message || e.toString() };
  }
}

// -------------------------------------------------------------
// Eliminar una carga académica (protegido)
// -------------------------------------------------------------
function eliminarCargaAcademicaGS(key) {
  try {
    if (!_canManageCarga_()) return { success: false, error: 'No autorizado' };
    if (!key || !key.Email) return { success: false, error: 'Clave inválida' };
    const sh = cargaSh_();
    const idx = findRowIndexByKey_(sh, key.Email, key.id_seccion, key.Ciclo);
    if (idx <= 0) return { success: false, message: 'No existe registro' };
    sh.deleteRow(idx);
    return { success: true, message: 'Asignación eliminada' };
  } catch (e) {
    Logger.log('eliminarCargaAcademicaGS: ' + e.toString());
    return { success: false, error: e.message || e.toString() };
  }
}

// -------------------------------------------------------------
// Buscar fila por clave (Email + id_seccion + Ciclo)
// -------------------------------------------------------------
function findRowIndexByKey_(sh, email, id_seccion, ciclo) {
  const vals = sh.getDataRange().getValues();
  const head = vals[0].map(String);
  const iEmail = head.indexOf('Email');
  const iSec = head.indexOf('id_seccion');
  const iCiclo = head.indexOf('Ciclo');
  if (iEmail === -1 || iSec === -1 || iCiclo === -1) return -1;
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    if (
      String(r[iEmail]) === String(email) &&
      String(r[iSec]) === String(id_seccion) &&
      String(r[iCiclo]) === String(ciclo)
    ) {
      return i + 1;
    }
  }
  return -1;
}

// -------------------------------------------------------------
// Listas para selects (docentes, materias, secciones, ciclos)
// -------------------------------------------------------------
function getCargaAcademicaLists() {
  const ss = ss_();

  function safeRead(sheet, mapFn) {
    const sh = ss.getSheetByName(sheet);
    if (!sh) return [];
    const v = sh.getDataRange().getValues();
    if (v.length < 2) return [];
    return v.slice(1).map(mapFn);
  }

  const docentes = safeRead('Usuarios', r => ({
    Email: r[0],
    Nombre: r[1] || r[0],
    Rol: (r[2] || '').toLowerCase()
  })).filter(d => d.Rol === 'docente' || d.Rol === 'profesor');

  const materias = safeRead('Materias', r => {
    const id = (r[0] || '').toString().trim();
    const nom = (r[1] || '').toString().trim();
    return { id_materia: id, Nombre: nom ? `${id} — ${nom}` : id };
  });

  const secciones = safeRead('Secciones', r => {
    const id = (r[0] || '').toString().trim();
    const n = [r[1], r[2], r[3]]
      .map(x => (x || '').toString().trim())
      .filter(Boolean)
      .join(' - ');
    return { id_seccion: id, Nombre: n || id };
  });

  const shCarga = ss.getSheetByName(SHEET_CARGA);
  const ciclosSet = new Set();
  if (shCarga) {
    const v = shCarga.getDataRange().getValues();
    const head = v[0].map(String);
    const iC = head.indexOf('Ciclo');
    for (let i = 1; i < v.length; i++) {
      const c = (v[i][iC] || '').toString().trim();
      if (c) ciclosSet.add(c);
    }
  }

  const actual = cicloActual_();
  if (actual) ciclosSet.add(actual);
  const ciclos = Array.from(ciclosSet).map(Ciclo => ({ Ciclo }));

  return { docentes, materias, secciones, ciclos };
}