import "./style.css";
import bgUrl from "./assets/bg.png";
import bird1Url from "./assets/bird1.png";
import bird2Url from "./assets/bird2.png";
import bird3Url from "./assets/bird3.png";
import deadBirdUrl from "./assets/deadbird.png";
import homeScreenUrl from "./assets/flappy_start.png";
import gameOverUrl from "./assets/game_over.png";
import pipeBottomUrl from "./assets/pipe_bottom.png";
import pipeTopUrl from "./assets/pipe_top.png";

// @ts-ignore
const $ = (
  e: string
): HTMLInputElement & {
  on<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (tg: HTMLInputElement) => void
  ): void;
} => {
  return Object.assign(
    document.querySelector(e) as HTMLInputElement,
    {
      on(type, l) {
        this.addEventListener(type, () => l(this));
      },
    } as HTMLInputElement & {
      on: (type: string, l: (t: HTMLInputElement) => void) => void;
    }
  );
};

const canvasContainer = document.querySelector(".canvas-container")!;
const canvas = canvasContainer.appendChild(document.createElement("canvas"));
canvas.width = 600;
canvas.height = 500;

const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!;
ctx.font = "30px Comic Sans MS, Comic Sans";
ctx.textAlign = "center";
ctx.lineCap = "round";

// Controls
let pipeControl = false;
let flip = false;
let backwards = false;
let mode = 0;
let trailEnabled = false;

let playerX = backwards ? canvas.width - 100 : 100,
  playerInitialY = 200,
  playerWidth = 68,
  playerHeight = 48,
  playerSpeed = backwards ? -4 : 4, // How fast the pipes move to the left
  jumpSpeed = flip ? 8 : -8,
  defaultGravity = flip ? -0.5 : 0.5,
  keyDown = false;

let poleWidth = 87,
  poleHeight = 381,
  poleGap = 150,
  minPoleY = poleHeight + poleGap / 2,
  maxPoleY = canvas.height - poleHeight - poleGap / 2,
  poleSpawn = backwards ? 0 - poleWidth : canvas.width;

function calculateMinMax() {
  minPoleY = poleHeight + poleGap / 2;
  maxPoleY = canvas.height - poleHeight - poleGap / 2;
  const x = minPoleY;
  const y = maxPoleY;

  minPoleY = Math.max(minPoleY, poleGap / 2 + 5);
  maxPoleY = Math.min(maxPoleY, canvas.height - poleGap / 2 + 5);

  if (y < x) {
    minPoleY = y;
    maxPoleY = x;
  }
}

ctx.strokeStyle = "lightgreen";

calculateMinMax();

function setBackwards(newBackwards: boolean) {
  backwards = newBackwards;
  playerX = backwards ? canvas.width - 100 - playerWidth : 100;
  playerSpeed = backwards ? 0 - Math.abs(playerSpeed) : Math.abs(playerSpeed);
  poleSpawn = backwards ? 0 - poleWidth : canvas.width;
}

function setFlip(newFlipped: boolean) {
  flip = newFlipped;
  jumpSpeed = flip ? Math.abs(jumpSpeed) : 0 - Math.abs(jumpSpeed);
  defaultGravity = flip
    ? 0 - Math.abs(defaultGravity)
    : Math.abs(defaultGravity);
}

function setPoleGap(newGap: number) {
  poleGap = newGap;
  calculateMinMax();
}

let homeWidth = 460,
  homeHeight = 366;

const homeScreen = new Image(homeWidth, homeHeight);
homeScreen.src = homeScreenUrl;

const bird1 = new Image(playerWidth, playerHeight);
bird1.src = bird1Url;

const bird2 = new Image(playerWidth, playerHeight);
bird2.src = bird2Url;

const bird3 = new Image(playerWidth, playerHeight);
bird3.src = bird3Url;

const birds = [bird1, bird2, bird3, bird2];
let birdIndex = 0;

const deadBird = new Image(playerHeight, playerWidth);
deadBird.src = deadBirdUrl;

const bg = new Image(960, 644);
bg.src = bgUrl;

const pipeBottomImg = new Image(poleWidth, poleHeight);
pipeBottomImg.src = pipeBottomUrl;

const pipeTopImg = new Image(poleWidth, poleHeight);
pipeTopImg.src = pipeTopUrl;

const gameOver = new Image(400, 81);
gameOver.src = gameOverUrl;

let lastPerformance = performance.now();

let gravity = defaultGravity;
let fallSpeed = 0;
let playerY = playerInitialY;
let prevY = playerY;

let score = 0;

let poles: { x: number; y: number }[] = [];

let hasCrashed = false;
let isOnHomeScreen = true;

let poleRate = 1500;

let trail = [{ x: playerX, y: playerY }];

function drawBird() {
  if (trailEnabled)
    trail.push({ x: playerX + playerWidth / 2, y: playerY + playerWidth / 2 });

  ctx.beginPath();
  ctx.lineWidth = 20;
  if (trail[0]) ctx.moveTo(trail[0].x, trail[0].y);

  trail = trail.filter(({ x, y }, i) => {
    trail[i].x -= hasCrashed ? 0 : playerSpeed;
    x -= playerSpeed;
    if (x < -20 || x > 620) return false;
    ctx.lineTo(x - 5, y - 5);
    return true;
  });
  ctx.stroke();
  ctx.save();
  ctx.translate(playerX + playerWidth / 2, playerY + playerHeight / 2);

  if (flip) ctx.scale(1, -1);
  if (backwards) ctx.scale(-1, 1);
  if (mode != 0) {
    ctx.rotate(
      Math.atan2(playerY - prevY, Math.abs(playerSpeed)) * (flip ? -1 : 1)
    );
  }

  if (hasCrashed && mode == 0) {
    ctx.drawImage(
      deadBird,
      playerWidth / 2 - playerHeight,
      playerHeight / 2 - playerWidth
    );
  } else {
    ctx.drawImage(birds[birdIndex], 0 - playerWidth / 2, 0 - playerHeight / 2);
  }
  ctx.restore();
}

function drawScore() {
  ctx.fillText(score.toString(), canvas.width / 2, 50);
}

function drawPole({ x, y }: (typeof poles)[number]) {
  ctx.drawImage(pipeTopImg, x, y - poleGap / 2 - poleHeight);
  ctx.drawImage(pipeBottomImg, x, y + poleGap / 2);
}

function removePoles() {
  let len = poles.length;
  poles = poles.filter((pole) =>
    backwards ? pole.x < canvas.width : pole.x + poleWidth > 0
  );
  score += len - poles.length;
}

function isDead() {
  return poles.some(({ x: poleX, y: poleY }) => {
    if (playerX + playerWidth > poleX && poleX + poleWidth > playerX) {
      return (
        playerY < poleY - poleGap / 2 ||
        playerY + playerHeight > poleY + poleGap / 2
      );
    }

    return false;
  });
}

/**
 * @param {number} newValue
 */
function setPolerate(newValue: number) {
  poleRate = newValue;
}

function home() {
  keyDown = false;
  trail.length = 0;
  ctx.drawImage(bg, 0, canvas.height - bg.height);
  ctx.drawImage(
    homeScreen,
    (canvas.width - homeScreen.width) / 2,
    canvas.height - homeScreen.height
  );
  if (!isOnHomeScreen) {
    lastPerformance = performance.now();
    score = 0;
    poles = [];
    requestAnimationFrame(frame);
  } else requestAnimationFrame(home);
}

function frame() {
  prevY = playerY;
  ctx.drawImage(bg, 0, canvas.height - bg.height);
  fallSpeed += gravity;
  if (mode == 2)
    fallSpeed =
      Math.abs(playerSpeed) * 1.5 * (keyDown ? -1 : 1) * (flip ? -1 : 1);
  if (!pipeControl || hasCrashed) playerY += fallSpeed;

  if (mode == 1 && keyDown) {
    fallSpeed -= gravity * 2;
    if (Math.abs(fallSpeed) > 10) fallSpeed = Math.sign(fallSpeed) * 10;
  }

  if (Math.abs(fallSpeed) > 10) fallSpeed = Math.sign(fallSpeed) * 10;

  poles.forEach(
    (pole) => (
      !hasCrashed
        ? ((pole.x -= playerSpeed), pipeControl ? (pole.y -= fallSpeed) : null)
        : null,
      drawPole(pole)
    )
  );

  drawScore();
  drawBird();

  removePoles();

  !hasCrashed && isDead() && (hasCrashed = true);
  if (
    (!flip && playerY + playerHeight > canvas.height) ||
    (flip && playerY <= 0)
  ) {
    ctx.drawImage(
      gameOver,
      (canvas.width - gameOver.width) / 2,
      (canvas.height - gameOver.height) / 2
    );

    setTimeout(() => {
      isOnHomeScreen = true;
      playerY = playerInitialY;
      gravity = defaultGravity;
      playerSpeed = +$('#speed-control').value * (backwards?-1:1)
      fallSpeed = 0;
      hasCrashed = false;

      home();
    }, 1000);
  } else {
    if (performance.now() - lastPerformance > poleRate) {
      newPole();
      lastPerformance = performance.now();
    }
    requestAnimationFrame(frame);
  }
}

function jump() {
  if (isOnHomeScreen) {
    isOnHomeScreen = false;
  }
  if (!hasCrashed) {
    mode == 3
      ? (setFlip(!flip), (gravity = defaultGravity))
      : mode == 1 || mode == 2
      ? (keyDown = true)
      : ((fallSpeed = jumpSpeed), (gravity = defaultGravity));
  }
}

addEventListener("keydown", (e) => {
  if (/ArrowUp| /.test(e.key) && !e.repeat) {
    e.preventDefault();
    canvasContainer.scrollIntoView({ behavior: "smooth" });
    jump();
  }
});
addEventListener("keyup", ({ key }) =>
  key === " " ? (keyDown = false) : null
);

canvas.addEventListener("mousedown", () => jump());
canvas.addEventListener("mouseup", () => (keyDown = false));

const newPole = () =>
  poles.push({
    x: poleSpawn,
    y: minPoleY + Math.round(Math.random() * (maxPoleY - minPoleY)),
  });

setInterval(() => (birdIndex = (birdIndex + 1) % 4), 100);
home();

$("#backwards-toggle").on("change", (t) => {
  setBackwards(t.checked);
  t.blur();
});

$("#flip-toggle").on("change", (t) => {
  setFlip(t.checked);
  t.blur();
});

$("#control-toggle").on("change", (t) => {
  pipeControl = t.checked;
  t.blur();
});

$("#trail-toggle").on("change", (t) => {
  trailEnabled = t.checked;
  t.blur();
});

$("#mode-control").on("input", (t) => {
  mode = +t.value;
});

$("#speed-control").on("input", (t) => {
  $("#speedDisplay").innerHTML =
    "Speed: " + Math.abs((playerSpeed = +t.value * (backwards ? -1 : 1)));
});

$("#rate-control").on("input", (t) => {
  $("#rateMonitor").innerHTML = `Pole span rate: ${
    (+t.value / 10) % 1 == 0 ? +t.value / 10 + ".0" : +t.value / 10
  }s`;
  setPolerate(+t.value * 100);
});

$("#gravity-control").on(
  "input",
  (t) =>
    ($("#gravityMonitor").innerHTML = `Gravity: ${(defaultGravity =
      (Math.sign(defaultGravity) * +t.value) / 100)}`)
);

$("#gap-control").on(
  "input",
  (t) => ($("#poleGapMonitor").innerHTML = `Pole gap: ${setPoleGap(+t.value)}`)
);
