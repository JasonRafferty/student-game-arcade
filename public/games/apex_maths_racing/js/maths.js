// Year 6 (UK KS2) maths questions, themed around the pit wall. Answers are numbers.
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const round2 = (x) => Math.round(x * 100) / 100;

const generators = [
  () => { // percentage of an amount
    const p = pick([10, 20, 25, 30, 40, 50, 75, 5, 15]), base = pick([40, 60, 80, 120, 160, 200, 240, 320, 360, 400]);
    return { topic: 'Percentages', text: `The fuel tank holds ${base} litres. What is ${p}% of ${base}?`, answer: round2(base * p / 100), explain: `${p}% = ${p}/100, so ${base} × ${p} ÷ 100 = ${round2(base * p / 100)}` };
  },
  () => { // fraction of an amount
    const d = pick([3, 4, 5, 6, 8]), n = ri(1, d - 1), k = ri(3, 12), base = d * k;
    return { topic: 'Fractions', text: `The team has ${base} tyres. ${n}/${d} of them are softs. How many soft tyres are there?`, answer: n * k, explain: `${base} ÷ ${d} = ${k}, then ${k} × ${n} = ${n * k}` };
  },
  () => { // long multiplication
    const a = ri(12, 48), b = ri(11, 29);
    return { topic: 'Multiplication', text: `A mechanic tightens ${b} wheel nuts per hour for ${a} hours. How many nuts is that? (${a} × ${b})`, answer: a * b, explain: `${a} × ${b} = ${a * b}` };
  },
  () => { // division
    const b = ri(4, 12), q = ri(12, 45);
    return { topic: 'Division', text: `${b * q} km shared equally over ${b} laps. How many km per lap?`, answer: q, explain: `${b * q} ÷ ${b} = ${q}` };
  },
  () => { // decimals × whole number
    const a = pick([1.2, 2.5, 3.4, 4.6, 5.8, 0.6, 7.5, 1.25]), b = ri(3, 9);
    return { topic: 'Decimals', text: `One lap is ${a} km. How far are ${b} laps in km?`, answer: round2(a * b), explain: `${a} × ${b} = ${round2(a * b)}` };
  },
  () => { // order of operations
    const a = ri(2, 9), b = ri(2, 9), c = ri(2, 6);
    return { topic: 'Order of operations', text: `Pit wall puzzle: what is ${a} + ${b} × ${c}?`, answer: a + b * c, explain: `Multiply first: ${b} × ${c} = ${b * c}, then add ${a} = ${a + b * c}` };
  },
  () => { // speed distance time
    const sp = pick([60, 90, 120, 150, 180, 200, 240]), t = pick([2, 3, 4, 5]);
    return { topic: 'Speed, distance, time', text: `The transporter drives at ${sp} km/h for ${t} hours. How many km does it travel?`, answer: sp * t, explain: `distance = speed × time = ${sp} × ${t} = ${sp * t}` };
  },
  () => { // negative numbers
    const morning = -ri(2, 8), rise = ri(6, 18);
    return { topic: 'Negative numbers', text: `At dawn the track was ${morning}°C. It warmed up by ${rise}°C. What is the temperature now?`, answer: morning + rise, explain: `${morning} + ${rise} = ${morning + rise}` };
  },
  () => { // ratio
    const a = ri(1, 4), b = ri(2, 5), k = ri(2, 6);
    return { topic: 'Ratio', text: `Red and white kerb blocks are in the ratio ${a}:${b}. There are ${a * k} red blocks. How many white blocks?`, answer: b * k, explain: `${a * k} ÷ ${a} = ${k} groups, × ${b} = ${b * k}` };
  },
  () => { // area
    const w = ri(4, 12), l = ri(6, 25);
    return { topic: 'Area', text: `A pit box is a rectangle ${l} m long and ${w} m wide. What is its area in m²?`, answer: w * l, explain: `area = ${l} × ${w} = ${w * l}` };
  },
  () => { // perimeter
    const w = ri(3, 15), l = ri(10, 30);
    return { topic: 'Perimeter', text: `The garage floor is ${l} m by ${w} m. What is its perimeter in metres?`, answer: 2 * (w + l), explain: `2 × (${l} + ${w}) = ${2 * (w + l)}` };
  },
  () => { // unit conversion
    const km = pick([1.5, 2.4, 3.7, 4.25, 5.8, 0.75]);
    return { topic: 'Converting units', text: `How many metres are in ${km} km?`, answer: km * 1000, explain: `1 km = 1000 m, so ${km} × 1000 = ${km * 1000}` };
  },
  () => { // squares and cubes
    const n = ri(3, 12), cube = Math.random() < 0.3 && n <= 6;
    return { topic: cube ? 'Cube numbers' : 'Square numbers', text: `What is ${n}${cube ? '³' : '²'}?`, answer: cube ? n ** 3 : n * n, explain: cube ? `${n} × ${n} × ${n} = ${n ** 3}` : `${n} × ${n} = ${n * n}` };
  },
  () => { // mean
    const vals = [ri(80, 99), ri(80, 99), ri(80, 99)]; const s = vals[0] + vals[1] + vals[2]; const fix = (3 - (s % 3)) % 3; vals[2] += fix;
    const mean = (s + fix) / 3;
    return { topic: 'Mean average', text: `Lap times in seconds: ${vals.join(', ')}. What is the mean lap time?`, answer: mean, explain: `(${vals.join(' + ')}) ÷ 3 = ${mean}` };
  },
  () => { // algebra
    const x = ri(3, 15), m = ri(2, 6), c = ri(1, 20);
    return { topic: 'Algebra', text: `${m}n + ${c} = ${m * x + c}. What is n?`, answer: x, explain: `${m * x + c} − ${c} = ${m * x}, then ÷ ${m} = ${x}` };
  },
  () => { // rounding
    const n = ri(10000, 99999);
    return { topic: 'Rounding', text: `${n} fans came to the race. Round this to the nearest thousand.`, answer: Math.round(n / 1000) * 1000, explain: `Look at the hundreds digit: ${n} → ${Math.round(n / 1000) * 1000}` };
  },
];

export function makeQuestion() { return pick(generators)(); }
export function checkAnswer(q, input) {
  const v = Number(String(input).replace(/,/g, '').trim());
  return Number.isFinite(v) && Math.abs(v - q.answer) < 0.011;
}
