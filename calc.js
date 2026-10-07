/* Pizza dough maths. Pure functions, no DOM. All weights in grams, temps in °C. */
(function (root) {
  const REF_TEMP = 23;          // °C at which fermentation "speed" is 1
  const DOUBLE_EVERY = 8;       // °C rise that roughly doubles yeast activity
  const FERMENT_DOSE = 1.5;     // yeast% x room-equivalent hours needed for a ready dough
  const SOURDOUGH_YEAST_EQ = 0.006; // effective yeast % per 1% starter (of total flour)

  const num = (v, d = 0) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d);
  const rate = (t) => Math.pow(2, (t - REF_TEMP) / DOUBLE_EVERY);

  function defaults() {
    return {
      name: '', style: 'New York', notes: '', photos: [],
      scaleBy: 'balls', balls: 4, ballWeight: 280, flour: 500,
      hydration: 68,
      salt: { on: true, pct: 2.5 },
      oil: { on: true, pct: 2 },
      sugar: { on: false, pct: 1 },
      yeast: 0.1,
      pf: { type: 'poolish', pct: 20, hyd: 100, yeast: 0.1 },
      ferment: { coldDays: 2, room: 23, fridge: 4, targetBulk: 4, speed: 1 },
      temp: { ddt: 24, flour: 20, pf: 20, friction: 0 },
    };
  }

  function compute(r) {
    const warnings = [];
    const h = num(r.hydration);
    const salt = r.salt.on ? num(r.salt.pct) : 0;
    const oil = r.oil.on ? num(r.oil.pct) : 0;
    const sugar = r.sugar.on ? num(r.sugar.pct) : 0;
    const yeast = num(r.yeast);
    const sumPct = h + salt + oil + sugar + yeast;

    let F;
    if (r.scaleBy === 'flour') F = num(r.flour);
    else F = (num(r.balls) * num(r.ballWeight)) / (1 + sumPct / 100);
    const total = F * (1 + sumPct / 100);

    const type = r.pf.type;
    const hasPf = type !== 'none';
    const pfFlour = hasPf ? F * num(r.pf.pct) / 100 : 0;
    const pfWater = hasPf ? pfFlour * num(r.pf.hyd) / 100 : 0;
    let pfYeast = type === 'poolish' ? pfFlour * num(r.pf.yeast) / 100 : 0;
    const totalYeast = F * yeast / 100;
    if (pfYeast > totalYeast) {
      warnings.push('Yeast in the pre-ferment is more than the total yeast, so the final dough gets none.');
      pfYeast = totalYeast;
    }

    const f = {
      flour: F - pfFlour,
      water: F * h / 100 - pfWater,
      salt: F * salt / 100,
      oil: F * oil / 100,
      sugar: F * sugar / 100,
      yeast: totalYeast - pfYeast,
    };
    if (f.flour < -1e-9) warnings.push('Pre-ferment is more than 100% of the flour.');
    if (f.water < -1e-9) warnings.push('Pre-ferment holds more water than the total hydration allows. Lower pre-ferment % or its hydration, or raise total hydration.');
    const finalHydration = f.flour > 0 ? f.water / f.flour * 100 : null;

    const totals = {
      flour: F, water: F * h / 100, salt: f.salt, oil: f.oil, sugar: f.sugar, yeast: totalYeast, dough: total,
    };
    return {
      warnings, hasPf, type,
      pf: { flour: pfFlour, water: pfWater, yeast: pfYeast, total: pfFlour + pfWater + pfYeast },
      final: f, finalHydration, totals,
      pct: { flour: 100, water: h, salt, oil, sugar, yeast },
      ballWeight: num(r.balls) > 0 ? total / num(r.balls) : null,
    };
  }

  function effectiveYeast(r) {
    const eq = r.pf.type === 'sourdough' ? num(r.pf.pct) * SOURDOUGH_YEAST_EQ : 0;
    return num(r.yeast) + eq;
  }

  /* Counter (bulk) hours before the dough goes in the fridge, for the chosen yeast/cold time. */
  function bulkHours(r) {
    const fe = r.ferment;
    const ye = effectiveYeast(r) * num(fe.speed, 1);
    if (ye <= 0) return { hours: null };
    const coldUnits = num(fe.coldDays) * 24 * rate(num(fe.fridge));
    const hours = (FERMENT_DOSE / ye - coldUnits) / rate(num(fe.room));
    return { hours: Math.max(hours, 0), over: hours < 0, longHours: hours > 16 };
  }

  /* Total commercial yeast % that lands on targetBulk counter hours. */
  function suggestYeast(r) {
    const fe = r.ferment;
    const denom = num(fe.speed, 1) *
      (num(fe.targetBulk) * rate(num(fe.room)) + num(fe.coldDays) * 24 * rate(num(fe.fridge)));
    if (denom <= 0) return null;
    const eq = r.pf.type === 'sourdough' ? num(r.pf.pct) * SOURDOUGH_YEAST_EQ : 0;
    return Math.max(Math.round((FERMENT_DOSE / denom - eq) * 1000) / 1000, 0);
  }

  /* Water temp so the mixed dough lands on the desired dough temp. */
  function waterTemp(r) {
    const t = r.temp, room = num(r.ferment.room);
    const hasPf = r.pf.type !== 'none';
    const n = hasPf ? 4 : 3;
    const w = num(t.ddt) * n - num(t.flour) - room - num(t.friction) - (hasPf ? num(t.pf) : 0);
    return { temp: w, factors: n };
  }

  const fmt = (n, dp = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toFixed(dp));
  function fmtHours(h) {
    if (h === null || h === undefined) return '–';
    const m = Math.round(h * 60);
    const hh = Math.floor(m / 60), mm = m % 60;
    return hh ? `${hh} h ${String(mm).padStart(2, '0')} min` : `${mm} min`;
  }

  const api = { defaults, compute, bulkHours, suggestYeast, waterTemp, effectiveYeast, fmt, fmtHours, num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PizzaCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
