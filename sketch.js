//TIME IS FINITE INTERACTIVE NARRATIVE! CREATIVE CODING FINAL PROJECT :D - EILEEN YANG
// goal: make people feel the urgency of their time and motivate goal-setting

// --- CONSTANTS ---

const COLUMNS = 52; // 52 weeks in a year = 52 columns in the grid
let targetYears = 80; // default lifespan; user can change to 60 or 100

const CELL = 10; // each grid cell is 10x10px (box + gap)
const BOX  = 8;  // visible box is 8x8px; the 2px gap comes from CELL - BOX

// CITATION: Math.floor() — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor
const GRID_X = Math.floor((600 - COLUMNS * CELL) / 2); //floor rounds down to nearest whole number. math.floor means we're rounding down from result of (600 - 52*10) which calculate s remaining space after accounting for da grid width 
// (600 - 52*10) / 2 = 40px left margin, centering the 520px-wide grid in the 600px grid area

const GRID_Y = 90;
const GRID_AREA_WIDTH = 600; // grid lives in the left 600px of the 800px canvas
const GRID_CX = 300; // horizontal center of the grid area
const SIDEBAR_X = 620; // where the sidebar starts (right of the grid)
const SIDEBAR_W = 170; // sidebar width in pixels

// Goal colors by duration — pink = urgent (30D), blue = medium (60D), green = long (90D)
function getGoalColor(days) {
  if (days === 30) return '#E05080';
  if (days === 60) return '#4A90D9';
  return '#50C878';
}


// --- GLOBAL VARIABLES ---

let canelaFont;
let tickSound;
let scene; // currently active scene object
let birthDate;
let weeksLived, yearsLived, weeksRemaining;
let birthdayWeeks = new Set();
//set is used here because .has(i) checks membership in constant time, unlike looping through an array
//unlike an array which would need to loop through every element to match - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set

let lastHoveredBox = -1;

let goals= []; // array of { text, days, color, recs, boxIdx }
let pendingGoal = null; // goal being processed during the loading screen
let pendingRecs = []; //array of the 3 daily action step recommendations we get back from the server/ API call based off users inputted goal/duration
let goalDays= 90;
let fetchDone= false;


// --- PRELOAD ---
// CITATION: loadFont(), loadSound() — https://p5js.org/reference/p5/loadFont/
function preload() {
  canelaFont = loadFont('data/CanelaText-Light-Trial.otf');
  tickSound= loadSound('data/tick.mp3');
}

// --- SETUP ---
// Canvas is 800x930: 600px grid area + 200px sidebar
function setup() {
  createCanvas(800, 930);
  goTo(inputScene);
}


function draw() {
  background('#000000');
  scene.draw();
}

// p5.js fires these on input. ?. (optional chaining) silently skips if the scene has no handler.
function keyPressed()   { scene.handleKey?.(); }
function mousePressed() { scene.handleClick?.(); }

// goTo() transitions scenes: calls onExit on the old one, swaps, calls onEnter on the new one
function goTo(s) {
  scene?.onExit?.();
  scene = s;
  scene.onEnter?.();
}


// --- GOAL HOVER DETECTION ---
// Returns the goal object the mouse is hovering near, or null.
// Uses an expanded 3x3-cell hit area around each goal box so it's easier to hover.
function getHoveredGoal(maxVisible) {
  for (let i = 0; i < goals.length; i++) {
    let g = goals[i];
    if (g.boxIdx >= maxVisible) continue;
    let goalCol = g.boxIdx % COLUMNS;// column = remainder after dividing by 52
    let goalRow = floor(g.boxIdx / COLUMNS); // row = how many full years have passed

    // expand the hit area one cell outward in every direction
    let ex = GRID_X + (goalCol - 1) * CELL;
    let ey = GRID_Y + (goalRow - 1) * CELL;
    let es = 2 * CELL + BOX; // total size = 3 cells wide/tall

    if (mouseX >= ex && mouseX <= ex + es && mouseY >= ey && mouseY <= ey + es) return g;
  }
  return null;
}


// --- DRAW GRID ---
// CITATION: rect(), fill(), sin(), map() — https://p5js.org/reference/p5/rect/
function drawGrid(count) {
  noStroke();
  let hoveredGoal = getHoveredGoal(count);

  for (let i = 0; i < count; i++) {
    let col = i % COLUMNS;// % gives the remainder — cycles 0–51 for each row of 52 weeks
    let row = floor(i / COLUMNS); // floor() gives the whole-number year this week belongs to
    let x = GRID_X + col * CELL;
    let y = GRID_Y + row * CELL;

    // skip the 3x3 area around the hovered goal — it gets drawn expanded after the loop
    if (hoveredGoal) {
      let hCol = hoveredGoal.boxIdx % COLUMNS;
      let hRow = floor(hoveredGoal.boxIdx / COLUMNS);
      if (abs(col - hCol) <= 1 && abs(row - hRow) <= 1) continue;
      // abs() = absolute value; this checks if the box is within 1 step of the goal in any direction
    }

    // find if any goal's deadline lands on this box
    let matchingGoal = null;
    for (let gi = 0; gi < goals.length; gi++) {
      if (goals[gi].boxIdx === i) { matchingGoal = goals[gi]; break; }
    }

    if (i === weeksLived) {
      // animate the current week: sin() produces a smooth wave between -1 and 1
      // map() stretches that range into 100–255 alpha, creating a pulsing breathing effect
      let pulse = map(sin(frameCount * 0.12), -1, 1, 100, 255);
      fill(210, 50, 50, pulse);

    } else if (matchingGoal) {
      fill(matchingGoal.color); // pink / blue / green depending on goal duration

    } else if (birthdayWeeks.has(i)) {
      fill(i < weeksLived ? '#8FAAB8' : '#3A5566'); // past birthdays lighter, future darker

    } else if (i < weeksLived) {
      fill('#D2D2C8');

    } else {
      fill('#202020');
    }

    rect(x, y, BOX, BOX, 1.5);
  }

  // draw the expanded goal box on top of the grid when hovered
  if (hoveredGoal) {
    let hCol = hoveredGoal.boxIdx % COLUMNS;
    let hRow = floor(hoveredGoal.boxIdx / COLUMNS);
    let hx = GRID_X + hCol * CELL;
    let hy = GRID_Y + hRow * CELL;
    fill(hoveredGoal.color);
    rect(hx - CELL, hy - CELL, 2 * CELL + BOX, 2 * CELL + BOX, 3);
  }
}


// --- COMPUTE WEEKS ---
function computeWeeks(bd) {
  birthDate = bd;

  let msPerWeek = 1000 * 60 * 60 * 24 * 7;
  // milliseconds per week: 1000ms × 60s × 60min × 24hr × 7days = 604,800,000

  weeksLived     = floor((Date.now() - bd) / msPerWeek);
  // Date.now() = current time in ms. Subtracting birth gives elapsed ms. Dividing by msPerWeek = weeks.

  yearsLived     = floor(weeksLived / COLUMNS);
  // dividing total weeks by 52 (COLUMNS) gives us full years lived -- floor drops the partial year
  weeksRemaining = COLUMNS * targetYears - weeksLived;
  // total weeks in a lifetime (52 * 80 = 4160) minus weeks already lived = weeks left !!

  birthdayWeeks.clear();
  // reset the set before recalculating so we dont stack up duplicates from a prev session
  for (let y = 1; y <= targetYears; y++) {
    // create a Date for the birthday in each future year, keeping the same month and day
    let bday = new Date(bd.getFullYear() + y, bd.getMonth(), bd.getDate());
    let idx  = floor((bday - bd) / msPerWeek);
    // same math as above -- how many weeks from birth to this specific bday
    if (idx >= 0 && idx < COLUMNS * targetYears) birthdayWeeks.add(idx);
    // only add it if its a valid box within the grid range (0 to 4160)
  }
}


// --- DATE HELPERS ---
// formatDigits() inserts slashes: "01151990" → "01/15/1990"
function formatDigits(d) {
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}

function parseDate(str) {
  let parts = str.split('/');
  if (parts.length !== 3) return null;

  let m = Number(parts[0]), d = Number(parts[1]), y = Number(parts[2]);
  if (!m || !d || !y || y < 1900) return null;

  let date = new Date(y, m - 1, d); // JS months are 0-indexed, so subtract 1 from month

  // re-check fields to catch invalid dates JS silently rolls over (e.g. Feb 31 → Mar 3)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;

  return date;
}


// --- TOOLTIP ---
// CITATION: textWidth() — https://p5js.org/reference/p5/textWidth/
function getHoveredBox() {
  for (let i = 0; i < COLUMNS * targetYears; i++) {
    let col = i % COLUMNS;
    let row = floor(i / COLUMNS);
    let x = GRID_X + col * CELL;
    let y = GRID_Y + row * CELL;
    if (mouseX >= x && mouseX <= x + BOX && mouseY >= y && mouseY <= y + BOX) return i;
  }
  return -1;
}

function getBoxLabel(i) {
  for (let gi = 0; gi < goals.length; gi++) {
    if (goals[gi].boxIdx === i) {
      return 'GOAL: "' + goals[gi].text.toUpperCase() + '" · ' + goals[gi].days + ' DAYS';
    }
  }
  let age     = floor(i / COLUMNS);
  let boxDate = new Date(birthDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
  // birthDate.getTime() in ms + i weeks in ms gives the calendar date of this box
  let month   = boxDate.getMonth(); // 0 = Jan, 11 = Dec

  let season = (month <= 1 || month === 11) ? 'winter'
             : month <= 4                   ? 'spring'
             : month <= 7                   ? 'summer'
             :                               'fall';
  // chained ternary operators map month numbers to season names

  return 'AGE ' + age + ' · ' + season.toUpperCase() + ' ' + boxDate.getFullYear();
}

function drawTooltip(maxVisible) {
  let i  = getHoveredBox();
  let hg = getHoveredGoal(maxVisible);
  if (hg) i = hg.boxIdx;

  if (i !== lastHoveredBox) {
    lastHoveredBox = i;
    if (i >= 0 && i < maxVisible) tickSound.play();
    // only play the tick sound when entering a new box, not every frame
  }

  if (i < 0 || i >= maxVisible) return;

  let label = getBoxLabel(i);
  textFont('Menlo');
  textSize(10);
  textAlign(CENTER); //left, center

  let tw = textWidth(label) + 16; // textWidth() measures pixel width of a string at the current font/size
  let th = 22;
  let tx = mouseX + 12;
  let ty = mouseY - 28;

  if (tx + tw > GRID_AREA_WIDTH) tx = mouseX - tw - 12; // flip left if it would go off the grid edge
  if (ty < GRID_Y)               ty = mouseY + 10;       // flip down if it would go above the grid

  fill('#0F0F0FE6'); 
  stroke('#373737');
  strokeWeight(1);
  rect(tx, ty, tw, th, 4);
  noStroke();
  fill('#BEBEBE');
  text(label, tx + 8, ty + th / 2);
}


// --- LEGEND ---
function drawLegend() { // legend boxes and labels are hardcoded to always show, we are assigning specific colors and labels to each item in the legend, and then drawing them in a loop 
  let items = [
    {col: color(210, 50, 50), label: 'NOW'},
    {col: color('#D2D2C8'),label: 'LIVED'},
    { col: color('#8FAAB8'),label: 'BIRTHDAY' },
    { col: color('#E05080'),label: '30D'},
    { col: color('#4A90D9'), label: '60D'},
    { col: color('#50C878'),label: '90D'},
  ];

  //legend positioning
  let spacing = GRID_AREA_WIDTH / items.length; // divide 600px evenly among 6 items = 100px each. we do this bc the legend is designed to always fill the entire grid area, so calculated spacing  based on the # of items
  let y = 900; //fixed y position for legent
  noStroke();
  textFont('Menlo');
  textSize(9);
  textAlign(CENTER, TOP);

  //loop through items array to draw legend
  for (let i = 0; i < items.length; i++) {
    let cx = spacing * i + spacing / 2; // horizontal center of this legend item's zone
    fill(items[i].col); //.col = color we assigned to this item in the array
    rect(cx - 4, y, 8, 8, 1.5); 
    fill('#555555');
    text(items[i].label, cx, y + 13);
  }
}


// =============================================================================
// SCENES
// Each scene is a plain JS object. goTo() calls onEnter/onExit on transitions.
// draw() runs every frame; handleKey() and handleClick() run on input events.
// =============================================================================


// ======SCENE 1: INPUT===========================
const inputScene = { 
  digits: '',    // raw digits as the user types (e.g. "01151990")
  btnRects: [],  // bounding rects for 60/80/100 buttons, used for click detection

  onEnter() {
    this.digits = ''; //to explain this granularly, when the user enters the inputScene, 
    // we want to reset the digits variable to an empty string so that any previous 
    // input is cleared and the user can start fresh. This ensures that if they navigate 
    // back to this scene, they won't see their old input still there, which could be confusing 
    document.getElementById('bg-video').style.display = 'block'; // show background video
    document.getElementById('bg-overlay').style.display = 'block'; 
  },
  onExit() {
    document.getElementById('bg-video').style.display = 'none'; //remove background video when leaving
    document.getElementById('bg-overlay').style.display = 'none';
  },

  draw() {
    clear(); // transparent canvas so the HTML background video shows through

    let cx = width / 2; // center x for text/buttons
    let cy = height / 2 - 10;
    textAlign(CENTER, CENTER);
    textFont('Menlo');
    noStroke();
    textSize(13);
    fill('#FFFFFF');
    text('HI FRIEND!', cx, cy - 100);
    fill('#878787');
    text('WHEN IS YOUR BIRTHDAY?', cx, cy - 68);
    let bw = 270, bh = 50;
    let bx = cx - bw / 2, by = cy - 42;
    fill('#FFFFFF');
    noStroke();
    rect(bx, by, bw, bh, 999); // corner radius 999 makes it a pill shape

    textSize(16);
    if (this.digits.length === 0) {
      fill('#AAAAAA');
      text('MM/DD/YYYY', cx, by + bh / 2);
    } else {
      fill('#000000');
      text(formatDigits(this.digits), cx, by + bh / 2);
    }

    textSize(12);
    fill('#878787');
    text('HOW LONG DO YOU PLAN TO LIVE?', cx, cy + 42);

    let options = [60, 80, 100]; // lifespan options in years
    let btnW = 70, btnH = 32, gap = 16; //
    let totalW = options.length * btnW + (options.length - 1)*gap;
    let startX = cx - totalW / 2; // center the button row horizontally
    let btnY   = cy + 62;
    this.btnRects = [];

    for (let i = 0; i < options.length; i++) { //loop thru lifespan options to draw buttons and set up click zones - length: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/length 
      let bx2 = startX + i * (btnW + gap);
      this.btnRects.push({x: bx2, y: btnY, w: btnW, h: btnH, val: options[i]}); //this is creating a rectangle object for each btn with x,y,w,h tha define its position and size, and val to store lifespan value. these rects are used ltr in handleclick to check if mouse is within any button when clicked

      if (options[i] === targetYears) { //highlighting selected lifespan
        fill('#FFFFFF'); stroke('#FFFFFF');
      } else {
        fill('#282427'); stroke('#555555');
      }
      strokeWeight(1);
      rect(bx2, btnY, btnW, btnH, 6); //rounded corners = 6
      noStroke();
      if (options[i] === targetYears){
        fill('#000000');
      } else {
        fill('#999999');
      };
      textSize(13);
      text('' + options[i], bx2 + btnW / 2, btnY + btnH / 2);
    }

    textSize(11);
    fill('#AAAAAA');
    text('PRESS ENTER ↵ TO CONTINUE', cx, cy + 128);
  },

  handleKey() {
    if (keyCode === ENTER) {
      let date = parseDate(formatDigits(this.digits));
      if (!date || date > new Date()) return; // reject invalid or future dates

      computeWeeks(date);
      goals = [];
      goTo(transitionScene);

    } else if (keyCode === BACKSPACE) {
      this.digits = this.digits.slice(0, -1); // slice(0, -1) removes the last character

    } else if (key >= '0' && key <= '9' && this.digits.length < 8) {
      this.digits += key; // max 8 digits = mmddyyyy
    }
  },
// CITATION: mouseX, mouseY, mousePressed() — https://p5js.org/reference/p5/mouseX.html 
  handleClick() {
    for (let b of this.btnRects) { //check if click is within lifespan button
      if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) { //if click is within button bounds, set targetyears to buttons value
        targetYears = b.val;  //b.val stores the lifespan value (60, 80, or 100) that we assigned when creating the btnRects in draw()
      }
    }
  }
};


// --- SCENE 2: TRANSITION ---
const transitionScene = { //timed transition
  onEnter() { this.startTime = millis(); },

  draw() {
    let elapsed = millis() - this.startTime;

    // fade in: ramps alpha from 0→255 over the first 600ms, then stays at 255
    let a = elapsed < 600 ? (elapsed /600) * 255 : 255;

    noStroke();
    textAlign(CENTER, CENTER);
    textFont('Menlo');
    textSize(13);
    fill(255, a);
    text('YOU MADE IT THROUGH', GRID_CX, height / 2 - 34);
    textFont('Menlo');
    textSize(70);
    fill(255, a);
    text(yearsLived + ' YEARS', GRID_CX,height / 2 + 22);

    if (elapsed > 2200) goTo(introBoxScene);
  }
};


// --- SCENE 3: INTRO BOX ---
const introBoxScene = {
  onEnter() { this.startTime = millis(); }, //when entering IntroBoxScene, we record current time in ms to use as reference point
  draw() {
    let elapsed = millis() - this.startTime; //this.startTime is the time when we entered the scene, so subtracting it from the current time gives us how long we've been in this scene. we use this elapsed time to ctrl timing of the fade-in and blinking effects
    let a = min(255, (elapsed / 600) * 255);  //fade in alpha from 0 to 255 over 600ms, then cap at 255 with min() to prevent it fom going higher

    noStroke();
    textAlign(CENTER, CENTER);
    textFont('Menlo');
    textSize(13);
    fill(255, a);
    text('THIS BOX REPRESENTS 1 WEEK OF YOUR LIFE...', GRID_CX, height / 2 - 70);

    // blink: floor(elapsed/400) increments every 400ms; %2 alternates 0 and 1 → on/off
    if (elapsed > 2300 || floor(elapsed / 400) % 2 === 0) { //if in scene for >2400 sec, keep box on or blink every 400ms
      fill(215);
      rect(GRID_CX - 11, height / 2 - 22, 22, 22, 4);
    }

    if (elapsed > 5000) goTo(gridLivedScene);
  }
};


// --- SCENE 4: GRID LIVED ---
const gridLivedScene = {
  onEnter() {
    this.progress = 0;
    this.doneTime = null;
  },

  draw() {
    if (this.progress < weeksLived + 1) {
      this.progress += 12; // reveal 12 more boxes per frame (~720/sec at 60fps)
      if (this.progress >= weeksLived + 1) this.doneTime = millis();
    }

    noStroke();
    textAlign(CENTER, TOP);
    textFont('Menlo');
    textSize(12);
    fill('#FFFFFF');
    text('YOU HAVE LIVED ' + yearsLived + ' YEARS', GRID_CX, 24);
    textSize(28);
    fill('#FFFFFF');
    text("THAT'S " + weeksLived.toLocaleString() + ' WEEKS', GRID_CX, 50);
    // .toLocaleString() adds commas to large numbers (e.g. 1300 → "1,300")

    drawGrid(floor(this.progress));
    drawTooltip(floor(this.progress));
    drawLegend();

    if (this.doneTime !== null && millis() - this.doneTime > 5000) goTo(goalScene);
  }
};


// --- SCENE 5: GOAL INPUT ---
const goalScene = {
  text: '',
  btnRects: [],

  onEnter() {
    this.text     = '';
    this.btnRects = [];
    fetchDone     = false;
  },

  draw() {
    let cx = GRID_CX;
    let bx = cx - 175, by = height / 2 + 20, bw = 350, bh = 50;

    noStroke();
    textAlign(CENTER, CENTER);
    textFont('Menlo');
    textSize(14);
    fill('#FFFFFF');
    text('WHAT DO YOU WANT TO ACCOMPLISH?', cx, height / 2 - 90);

    textSize(12);
    fill('#878787');
    text('HOW MANY DAYS FROM NOW?', cx, height / 2 - 58);

    let options = [30, 60, 90];
    let btnW = 66, btnH = 32, gap = 16;
    let totalW = options.length * btnW + (options.length - 1) * gap;
    let startX = cx - totalW / 2;
    let btnY   = height / 2 - 38;
    this.btnRects = [];

    for (let i = 0; i < options.length; i++) {
      let bx2      = startX + i * (btnW + gap);
      let btnColor = getGoalColor(options[i]); // each button is colored by its duration

      this.btnRects.push({ x: bx2, y: btnY, w: btnW, h: btnH, val: options[i] });

      if (options[i] === goalDays) {
        fill(btnColor); stroke(btnColor);
      } else {
        fill('#282427'); stroke('#555555');
      }
      strokeWeight(1);
      rect(bx2, btnY, btnW, btnH, 6);
      noStroke();
      fill(options[i] === goalDays ? '#000000' : '#999999');
      textSize(13);
      text('' + options[i], bx2 + btnW / 2, btnY + btnH / 2);
    }

    fill('#282427');
    stroke('#323232');
    strokeWeight(1);
    rect(bx, by, bw, bh, 999);
    noStroke();
    textSize(14);
    if (this.text.length === 0) {
      fill('#E7E7E7');
      text('TYPE YOUR GOAL...', cx, by + bh / 2);
    } else {
      fill('#FFFFFF');
      text(this.text, cx, by + bh / 2);
    }

    textSize(11);
    fill('#3C3C3C');
    text('PRESS ENTER ↵ TO CONTINUE', cx, height / 2 + 110);
  },

  handleKey() {
    if (keyCode === ENTER && this.text.length > 0) {
      pendingGoal = {
        text:   this.text,
        days:   goalDays,
        color:  getGoalColor(goalDays),
        boxIdx: weeksLived + Math.round(goalDays / 7)
        // Math.round(goalDays / 7) converts days to the nearest week count
        // adding weeksLived makes it an absolute position on the grid (not relative to today)
      };
      pendingRecs = [];
      fetchDone   = false;
      fetchRecommendations(this.text, goalDays); //starts the API call to get 3 daily action steps a user can take to achieve their goal based on goal/context/duration!!
      goTo(loadingScene);

    } else if (keyCode === BACKSPACE) {
      this.text = this.text.slice(0, -1);

    } else if (key.length === 1 && this.text.length < 60) {
      // key.length === 1 filters out special keys like arrows and ctrl (those have longer names)
      this.text += key;
    }
  },

  handleClick() {
    for (let b of this.btnRects) {
      if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
        goalDays = b.val;
      }
    }
  }
};


// ========================= API CALL =========================
// CITATION: Google docs - I used AI to help me do an API call and give 3 daily action recommendations to the user based off their goals
// CITATION: fetch() API — https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
// CITATION: async/await — https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises
// `async` lets this function run in the background without blocking the p5.js draw loop
async function fetchRecommendations(goal, days) { //(i used AI to help me create this function. it makes a POST request to the server with the user's goal and duration, 
// then waits for the response and updates the pendingRecs variable with the recs from the server.  
// allows us to fetch data without freezing the UI. a post request is a type of http request used to send data to a server. here, we are sending user goals/duration to the server so it can 
// generate personalized recommendations based on that info. the server processes the request and sends back a response, which we handle in the code below to update the app with the new recs)
  
try { //try means: attempt the code inside try and if something errors, jump to catch to handle i
    const res = await fetch('/api/recommendations', {
      method: 'POST', //// POST sends data to the server (vs GET which only retrieves)
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, days }) // JSON.stringify converts the JS object to a JSON string for the request
    });
    const data = await res.json(); // parse the server's JSON response into a JS object
    pendingRecs = data.recommendations || []; // || [] fallback in case the field is missing
  } catch (e) { //catch means if an error occurs in the try block , run this code to handle. 
    pendingRecs = []; 
  }
  fetchDone = true;
}


// --- SCENE 6: LOADING   ---
const loadingScene = {
  onEnter() { this.lastTick = millis(); this.dots = 0; },

  draw() {
    if (millis() - this.lastTick > 400) {
      this.dots = (this.dots + 1) % 4; // % 4 cycles 0→1→2→3→0, creating the animated dots
      this.lastTick = millis();
    }

    noStroke();
    textAlign(CENTER, CENTER);
    textFont('Menlo');
    textSize(13);
    fill('#878787');
    text('THINKING' + '.'.repeat(this.dots), GRID_CX, height / 2);
    // '.'.repeat(n) creates a string of n dots: 0="", 1=".", 2="..", 3="..."

    if (fetchDone) {
      let completedGoal = {
        text:   pendingGoal.text,
        days:   pendingGoal.days,
        color:  pendingGoal.color,
        boxIdx: pendingGoal.boxIdx,
        recs:   pendingRecs
      };
      goals.push(completedGoal);
      pendingGoal = null;
      goTo(gridFullScene);
    }
  }
};


// --- SCENE 7: FULL GRID + SIDEBAR ---
const gridFullScene = {
  onEnter() {
    this.startTime    = millis();
    this.totalVisible = weeksLived + 1;
    this.closeRects   = []; // stores × button positions each frame for click detection
  },

  draw() {
    let elapsed = millis() - this.startTime;
    let a = elapsed < 600 ? (elapsed / 600) * 255 : 255; // fade in over 600ms

    if (this.totalVisible < COLUMNS * targetYears) this.totalVisible += 3; // slowly sweep the full grid

    noStroke();
    textAlign(CENTER, TOP);
    textFont('Menlo');
    textSize(12);
    fill(255, a);
    text('IF YOU LIVE UNTIL ' + targetYears + ', YOU HAVE', GRID_CX, 24);
    textSize(28);
    fill(255, a);
    text(weeksRemaining.toLocaleString() + ' WEEKS LEFT', GRID_CX, 50);

    // when the API call finishes in the background, add the goal to the list
    if (fetchDone && pendingGoal !== null) {
      goals.push({text: pendingGoal.text, days: pendingGoal.days, color: pendingGoal.color, boxIdx: pendingGoal.boxIdx, recs: pendingRecs }); //this is an array of goal objects, w text/days/color/boxIdx/recs properties that we push a new goal into when the API call finishes. we are taking data from pendingGoal and pendingRecs to create a new goal object and add it to the goals array, which is what the rest of the app uses to display goals on the grid/sidebar
      pendingGoal = null;
      // Reference: Used AI to help me understand how to use Array.push to add the new goal: 
      // Array.push() — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push
      // push() adds a new object to the END of the goals array
    }

    drawGrid(floor(this.totalVisible)); 
    drawTooltip(floor(this.totalVisible));
    drawLegend();
    this.drawSidebar();
  },

  drawSidebar() {
    stroke('#252525');
    strokeWeight(1);
    line(608, GRID_Y, 608, 885); // vertical divider between grid and sidebar
    noStroke();

    textFont('Menlo');
    textSize(11);
    fill('#AAAAAA');
    textAlign(LEFT, TOP);
    text('GOALS', 618, 92);

    // "+ ADD GOAL" white pill button — position hardcoded, click zone matched in handleClick()
    fill('#FFFFFF');
    noStroke();
    rect(702, 88, 84, 22, 999);
    fill('#000000');
    textSize(9);
    textAlign(CENTER, CENTER);
    text('+ ADD GOAL', 744, 99); // 744 = 702 + 84/2 (horizontal center), 99 = 88 + 22/2 (vertical center)
    stroke('#252525');
    strokeWeight(1);
    line(618, 118, 786, 118); // horizontal divider under the header
    noStroke();

    this.closeRects = [];
    let y = 128; // y cursor: starts at top of first goal card

    for (let gi = 0; gi < goals.length; gi++) {
      let g = goals[gi];

      fill(g.color);
      ellipse(625, y + 7, 8, 8); // colored dot for this goal

      // goal title — p5.js wraps text automatically when you pass a width to text()
      fill('#FFFFFF');
      textFont('Menlo');
      textSize(10);
      textAlign(LEFT, TOP);
      text(g.text.toUpperCase(), 636, y, 132);
      // text(str, x, y, w) — the 4th argument tells p5 to word-wrap at 132px wide

      fill('#555555');
      textSize(12);
      textAlign(RIGHT, TOP);
      text('×', 786, y);
      this.closeRects.push({ x: 772, y: y - 2, w: 16, h: 16, idx: gi });

      fill('#555555');
      textSize(9);
      textAlign(LEFT, TOP);
      text(g.days + 'D · ' + g.days + 'D LEFT', 636, y + 26);

      // 3 action steps — also wrapped automatically using p5's 4-arg text()
      for (let ri = 0; ri < g.recs.length; ri++) {
        fill('#717171');
        textSize(9);
        textAlign(LEFT, TOP);
        text('› ' + g.recs[ri], 618, y + 42 + ri * 30, 168);
        // each bullet gets 30px of vertical space; wraps within the full 168px sidebar width
      }

      y += 140; // advance y cursor 140px for the next goal card (taller to fit wrapped text)

      if (gi < goals.length - 1) {
        stroke('#252525');
        strokeWeight(1);
        line(618, y - 6, 786, y - 6); // divider between goal cards
        noStroke();
      }
    }

    if (goals.length === 0) { //if there are no goals, show instructions in the sidebar
      fill('#333333');
      textFont('Menlo');
      textSize(9);
      textAlign(LEFT, TOP);
      text('NO GOALS YET.', 618, 140);
      text('CLICK + ADD GOAL', 618, 154);
      text('TO GET STARTED.', 618, 168);
    }

    if (goals.length > 0) { // show "clear all" to delete goals
      fill('#3A3A3A');
      textFont('Menlo');
      textSize(9);
      textAlign(RIGHT, TOP);
      text('CLEAR ALL', 786, 878);
    }
  },

  handleClick() {
    // "+ ADD GOAL" button: x=702 to 786, y=88 to 110
    if (mouseX >= 702 && mouseX <= 786 && mouseY >= 88 && mouseY <= 110) {
      goTo(goalScene);
      return;
    }

    // × buttons — closeRects stores positions set each frame in drawSidebar()
    //// Ref: Canvas button + manual hit detection pattern: https://www.khanacademy.org/computing/computer-programming/programming-games-visualizations/programming-buttons/a/a-button-function
    for (let i = 0; i < this.closeRects.length; i++) { //for if click is within any of closeButtons, remove goal from goals array
      let btn = this.closeRects[i]; //defining btn as the current closeRect we are checking in the loop. each closeRect has x,y,w,h that define the clickable area for that goal's × button, and idx which tells us which goal in the goals array this button corresponds
      if (mouseX >= btn.x && mouseX <= btn.x + btn.w && mouseY >= btn.y && mouseY <= btn.y + btn.h) {
        goals.splice(btn.idx, 1); // splice(index, 1) removes one element from the array
        return;
      }
    }
  }
};

// CITATIONS:
// docs.google.com/
