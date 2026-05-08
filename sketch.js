//interactive narrative of "time is finite"
//final project for creative coding 
//goal: communicate a sense of urgency for people to cherish their time, memories, & goals!


//CONSTANTS
const COLUMNS  = 52; // 52 weeks for a year
const ROWS = 80; //80 years in a life

//box size
const CELL= 10;
const BOX = 8;
const GRID_X = Math.floor((600 - COLUMNS * CELL) / 2); // center the grid horizontally                                                                      
const GRID_Y = 90; // how far down the grid starts                                                                                                               

//GLOBAL VARIABLES                                                                                                                                               
let canelaFont;
let tickSound;
let scene; // which screen we're on right now
let birthDate; // stored so hover tooltips can compute dates per box
let weeksLived, yearsLived, weeksRemaining; // the numbers we calculate from the birthday
let lastHoveredBox = -1;
let userGoal = ''; // stores the goal the user types in
                                                                                                                                                                 
function preload() { //load font
  canelaFont = loadFont('data/CanelaText-Light-Trial.otf');
  tickSound = loadSound('data/tick.mp3');
}                                                                                                                                                                
                                                          
function setup() { // runs once at the beginning                                                                                                                 
  createCanvas(600, 900);                       
  goTo(inputScene); // start on the birthday input screen                                                                                                        
}
                                                                                                                                                                 
function draw() {
  background(10);
  scene.draw();
}                                                                                                                                                                
                                                                                                                                                                 
function keyPressed()   { scene.handleKey?.(); }                                                                
function mousePressed() { scene.handleClick?.(); } 
                                                                                                                                                                 
function goTo(s) { // switch to a new screen
  scene = s;                                                                                                                                                     
  scene.onEnter?.(); // let the new screen set itself up  
}

//DRAWING THE GRID
function isGoalHovered(maxVisible) {
  if (userGoal === '') return false;
  let goalIdx = weeksLived + 13;
  if (goalIdx >= maxVisible) return false;
  let goalCol = goalIdx % COLUMNS;
  let goalRow = floor(goalIdx / COLUMNS);
  let ex = GRID_X + (goalCol - 1) * CELL;
  let ey = GRID_Y + (goalRow - 1) * CELL;
  let es = 2 * CELL + BOX;
  return mouseX >= ex && mouseX <= ex + es && mouseY >= ey && mouseY <= ey + es;
}

function drawGrid(count) {
  noStroke();
  let goalIdx = weeksLived + 13;
  let goalCol = goalIdx % COLUMNS;
  let goalRow = floor(goalIdx / COLUMNS);
  let goalX = GRID_X + goalCol * CELL;
  let goalY = GRID_Y + goalRow * CELL;
  let expanded = isGoalHovered(count);

  for (let i = 0; i < count; i++) {
    let col = i % COLUMNS;
    let row = floor(i / COLUMNS);
    let x = GRID_X + col * CELL;
    let y = GRID_Y + row * CELL;

    // skip the 3x3 area around the goal when expanded
    if (expanded && abs(col - goalCol) <= 1 && abs(row - goalRow) <= 1) continue;

    if (i === weeksLived) {
      let pulse = map(sin(frameCount * 0.12), -1, 1, 100, 255);
      fill(210, 50, 50, pulse);
    } else if (i === goalIdx && userGoal !== '') {
      fill(200, 165, 60);
    } else if (i < weeksLived) {
      fill(210, 210, 200);
    } else {
      fill(32);
    }
    rect(x, y, BOX, BOX, 1.5);
  }

  // draw expanded goal box on top
  if (expanded) {
    fill(200, 165, 60);
    rect(goalX - CELL, goalY - CELL, 2 * CELL + BOX, 2 * CELL + BOX, 3);
  }
}                                                                                                                                                                
                                                          
function computeWeeks(bd) {
  birthDate = bd; // store globally so tooltip can compute per-box dates
  let msPerWeek = 1000 * 60 * 60 * 24 * 7;
  weeksLived    = floor((Date.now() - bd) / msPerWeek);
  yearsLived     = floor(weeksLived / COLUMNS);
  weeksRemaining = COLUMNS * ROWS - weeksLived;
}                                                                                                                                                                
                                                                                                                                                                 
function formatDigits(d) { // insert slashes for display: "01151990" → "01/15/1990"
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0,2) + '/' + d.slice(2);
  return d.slice(0,2) + '/' + d.slice(2,4) + '/' + d.slice(4);
}

function parseDate(str) { // turn "mm/dd/yyyy" into a real date, or null if it's bad                                                                             
  let parts = str.split('/'); //splitting dates into parts                             
  if (parts.length !== 3) return null; //null is basically just no date                                                                                                                           
    let m = Number(parts[0]), d = Number(parts[1]), y = Number(parts[2]);                                                                                           
  if (!m || !d || !y || y < 1900) return null; //if the date is invalid, return null
    let date = new Date(y, m - 1, d);                                                                                                                              
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null; // catches things like feb 31                                  
  return date;                                                                                                                                                   
}                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                 
// HOVER TOOLTIP
function getHoveredBox() {
  for (let i = 0; i < COLUMNS * ROWS; i++) {
    let col = i % COLUMNS;
    let row = floor(i / COLUMNS);
    let x = GRID_X + col * CELL;
    let y = GRID_Y + row * CELL;
    if (mouseX >= x && mouseX <= x + BOX && mouseY >= y && mouseY <= y + BOX) return i;
  }
  return -1;
}

function getBoxLabel(i) {
  let age = floor(i / COLUMNS);
  let boxDate = new Date(birthDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
  let month = boxDate.getMonth();
  let season = (month <= 1 || month === 11) ? 'winter'
             : month <= 4 ? 'spring'
             : month <= 7 ? 'summer' : 'fall';

  // if this is the goal box, show the goal + how far away it is
  if (i === weeksLived + 13 && userGoal !== '') {
    let weeksAway = i - weeksLived; // weeks until the goal
    let daysAway  = weeksAway * 7;  // same but in days
    return `goal: "${userGoal}" · ${weeksAway} weks (${daysAway} days)`;
  }

  return `age ${age} · ${season} ${boxDate.getFullYear()}`;
}

function drawTooltip(maxVisible) {
  let i = getHoveredBox();
  if (isGoalHovered(maxVisible)) i = weeksLived + 13;
  if (i !== lastHoveredBox) {
    lastHoveredBox = i;
    if (i >= 0 && i < maxVisible) tickSound.play();
  }
  if (i < 0 || i >= maxVisible) return;
  let label = getBoxLabel(i);
  textFont('Menlo');
  textSize(10);
  textAlign(LEFT, CENTER);
  let tw = textWidth(label) + 16;
  let th = 22;
  let tx = mouseX + 12;
  let ty = mouseY - 28;
  if (tx + tw > width) tx = mouseX - tw - 12; // flip left if too close to edge
  if (ty < GRID_Y) ty = mouseY + 10;             // flip down if too close to top
  fill(15, 230);
  stroke(55);
  strokeWeight(1);
  rect(tx, ty, tw, th, 4);
  noStroke();
  fill(190);
  text(label, tx + 8, ty + th / 2);
}

//SCENES                                                                                                 
const inputScene = { // This is the first screen the user sees, inputting BIRTHDAY                                                                                                            
  digits: '', //                                                                                                                                                                                                            
  onEnter() { this.digits = ''; }, // clear the input box when we arrive                                                                                                                                                            
  draw() {                                                                                                                                                       
    let bx = width / 2 - 135, by = height / 2, bw = 270, bh = 50;                                                                                                                                           
    noStroke();                                                                                                                                                  
    textAlign(CENTER, CENTER);                                                                                                                                   
    textFont('Menlo');                                                                                                                                           
    textSize(14);                                         
    fill(255);
    text('hi friend!', width / 2, height / 2 - 60);
    fill(255);                                                                                                                                                   
    text('when is your birthday?', width / 2, height / 2 - 20);                                                                                             
                                                                                                                                                                 
    // draw the input box                                                                                                                                        
    fill("#282427"); 
    stroke(50); 
    strokeWeight(1);                
    rect(bx, by, bw, bh, 999);                                                                                                                                    
    noStroke();                                           
    textSize(16);                                                                                                                                                
    if (this.digits.length===0) { // showing a placeholder if nothing typed yet; this.digits is the inputted date                                                                               
      fill("#E7E7E7");
      text('mm/dd/yyyy', width / 2, by + bh / 2);                                                                                                             
    } else {                                              
      fill(255);
      text(formatDigits(this.digits), width / 2, by + bh / 2);
    }                                                                                                                                                                                                                  
    textSize(11);                                                                                                                                                
    fill(60);
    text('press enter ↵ to continue', width/2, height /2 + 90);                                                                                                      
  },                                                                                                                                                             

  handleKey() {                                                                                                                                                  
    if (keyCode === ENTER) { //submit the date           
      let date = parseDate(formatDigits(this.digits));
      if (!date || date > new Date()) return; //do nothing if the date is invalid                                                                               
      computeWeeks(date);                                                                                                                                        
      goTo(transitionScene);                                                                                                                                     
    } else if (keyCode === BACKSPACE) {
      this.digits = this.digits.slice(0, -1);
    } else if (key >= '0' && key <= '9' && this.digits.length < 8) {
      this.digits += key;
    }                                                     
  }                                                                                                                                                              
};                                                        

const transitionScene = { // screen 2: show how many years they've lived, fades in                                                                               
  onEnter() { this.startTime = millis(); }, // record when we arrived
            
  //DRAW TRANSITION SCENE 
  draw() {                                                
    let elapsed = millis() - this.startTime;
    let a;
    if (elapsed < 600) {
      a = (elapsed / 600) * 255;
    } else {
      a = 255;
    } // constrain is                                                                                                                                                                                               
    noStroke();                                                                                                                                                  
    textAlign(CENTER, CENTER);                                                                                                                                   
                                                          
    textFont('Menlo');                                                                                                                                           
    textSize(13);
    fill(135, a);                                                                                                                                                
    text('you made it through', width / 2, height / 2 - 34);
                                                                                                                                                                 
    textFont(canelaFont);
    textSize(70);                                                                                                                                                
    fill(255, a);                                         
    text(yearsLived + ' years', width / 2, height / 2 + 22);
                                                                                                                                                                 
    if (elapsed > 2200) goTo(introBoxScene); // move on after 2.2 seconds                                                                                        
  }                                                                                                                                                              
};                                                                                                                                                               
                                                          
const introBoxScene = { // screen 3: show what one week looks like as a box                                                                                      
  onEnter() { this.startTime = millis(); },
                                                                                                                                                                 
  draw() {                                                
    let elapsed = millis() - this.startTime;                                                                                                                     
    let a;
    if (elapsed < 600) {
      a = (elapsed / 600) * 255;
    } else {
      a = 255;
    } // fade in
                                                                                                                                                                 
    noStroke();
    textAlign(CENTER, CENTER);                                                                                                                                   
    textFont('Menlo');                                    
    textSize(13);
    fill(135, a);
    text('this box represents 1 week of your life...', width / 2, height / 2 - 70);
                                                                                                                                                                 
    //1 white box to represnet life lived                                                                                                                                                                                                                               
    fill(215 , a);                                                                                                                                      
    rect(width / 2 - 27, height / 2 - 22, 22, 22, 4);
                                                                                                                                                                 
    if (elapsed > 5000) goTo(gridLivedScene);
  }
};
                             
//SCREEN 4: Animate the part of filling in all the weeks you've lived
const gridLivedScene = { 
  onEnter() {
    this.progress = 0; // start drawing from box 0                                                                                                            
    this.doneTime = null; // idk when animation
  },                                                                                                                                                             
                                                          
  draw() {
    if (this.progress < weeksLived + 1) { // keep going until all lived weeks are drawn
      this.progress += 12; // draw 12 more boxes per frame (controls animation speed)                                                                            
      if (this.progress >= weeksLived + 1) this.doneTime = millis(); // note when we finished
    }                                                                                                                                                            
                                                          
    noStroke();                                                                                                                                                  
    textAlign(CENTER, TOP);                               

    textFont('Menlo');
    textSize(12);
    fill(135);
    text('you have lived ' + yearsLived + ' years', width / 2, 24);                                                                                           
    
    textFont('Menlo');                                                                                                                                    
    textSize(28);                                         
    fill(255);                                                                                                                                                   
    text("that's " + weeksLived.toLocaleString() + ' weeks', width / 2, 50);
                                                                                                                                                                 
    drawGrid(floor(this.progress));
    drawTooltip(floor(this.progress));

    if (this.doneTime !== null && millis() - this.doneTime > 5000) goTo(goalScene);
  }
};                                                                                                                                                               
                                                          
// SCREEN 5: ask the user what they want to acomplish in the next 3 months
const goalScene = {
  text: '',
  onEnter() { this.text = ''; }, // reset when we arrive

  draw() {
    let bx = width / 2 - 175, by = height / 2, bw = 350, bh = 50;
    noStroke();
    textAlign(CENTER, CENTER);
    textFont('Menlo');
    textSize(14);
    fill(255);
    text('what do you want to accomplish', width / 2, height / 2 - 60);
    text('in the next 3 months?', width / 2, height / 2 - 36);

    // draw the input box (same style as birthday input)
    fill('#282427');
    stroke(50);
    strokeWeight(1);
    rect(bx, by, bw, bh, 999);
    noStroke();
    textSize(14);
    if (this.text.length === 0) { // placeholder if nothings been typed yet
      fill('#E7E7E7');
      text('type your goal...', width / 2, by + bh / 2);
    } else {
      fill(255);
      text(this.text, width / 2, by + bh / 2);
    }
    textSize(11);
    fill(60);
    text('press enter ↵ to continue', width / 2, height / 2 + 90);
  },

  handleKey() {
    if (keyCode === ENTER && this.text.length > 0) { // only continue if somthing was typed
      userGoal = this.text;
      goTo(gridFullScene);
    } else if (keyCode === BACKSPACE) {
      this.text = this.text.slice(0, -1); // delete last character
    } else if (key.length === 1 && this.text.length < 60) { // any key, max 60 chars
      this.text += key;
    }
  }
};

const gridFullScene = { // screen 5: reveal the rest of the grid (weeks remaining)                                                                               
  onEnter() {
    this.startTime    = millis();                                                                                                                                
    this.totalVisible = weeksLived + 1; // start from where the last scene left off
  },                                                                                                                                                             

  draw() {                                                                                                                                                       
    let elapsed = millis() - this.startTime;              
    let a;
    if (elapsed < 600) {
      a = (elapsed / 600) * 255;
    } else {
      a = 255;
    } // fade in the text
                                                                                                                                                                 
    if (this.totalVisible < COLUMNS * ROWS) this.totalVisible += 3; // reveal 3 more boxes per frame
                                                                                                                                                                 
    noStroke();                                           
    textAlign(CENTER, TOP);

    textFont('Menlo');                                                                                                                                           
    textSize(12);
    fill(135, a);                                                                                                                                                
    text('if you live until 80, you have', width / 2, 24);

    textFont('Menlo');
    textSize(28);
    fill(255, a);                                                                                                                                                
    text(weeksRemaining.toLocaleString() + ' weeks left', width / 2, 50);
                                                                                                                                                                 
    drawGrid(floor(this.totalVisible));
    drawTooltip(floor(this.totalVisible));
  }
};       