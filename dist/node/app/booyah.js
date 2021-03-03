"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.go = exports.makePreloader = exports.DoneScene = exports.LoadingErrorScene = exports.ReadyScene = exports.LoadingScene = exports.CreditsEntity = exports.installMenu = exports.MenuEntity = exports.PlayOptions = void 0;
const PIXI = __importStar(require("pixi.js"));
const fontfaceobserver_1 = __importDefault(require("fontfaceobserver"));
// TODO: Once the PR has been accepted, move back to the version from NPM
const preload_it_esm_1 = __importDefault(require("./preload-it.esm"));
const util = __importStar(require("./util"));
const entity = __importStar(require("./entity"));
const audio = __importStar(require("./audio"));
const DEFAULT_DIRECTIVES = {
    screenSize: new PIXI.Point(960, 540),
    canvasId: "pixi-canvas",
    // Parameters for the game state machine
    states: [],
    transitions: {},
    startingScene: "start",
    startingSceneParams: {},
    startingProgress: {},
    endingScenes: ["end"],
    // Assets
    graphicalAssets: [],
    musicAssets: [],
    fxAssets: [],
    videoAssets: [],
    fontAssets: [],
    jsonAssets: [],
    // For narration
    speakers: {},
    speakerPosition: new PIXI.Point(50, 540),
    // Credits
    credits: {},
    creditsTextSize: 32,
    // Appearance. These assets are automatically added to "graphicalAssets"
    splashScreen: null,
    gameLogo: null,
    extraLogos: [],
    rootConfig: {},
    extraLoaders: [],
    entityInstallers: [],
    language: null,
    supportedLanguages: [],
    menuButtonPosition: null,
    // Standard icons. They will be added to "graphicalAssets"
    graphics: {
        menu: "booyah/images/button-mainmenu.png",
        skip: "booyah/images/button-skip.png",
        play: "booyah/images/button-play.png",
    },
};
const GRAPHICAL_ASSETS = [
    "booyah/images/a-playcurious-game.png",
    "booyah/images/button-back.png",
    "booyah/images/button-close.png",
    "booyah/images/button-replay.png",
    "booyah/images/fullscreen-off.png",
    "booyah/images/fullscreen-on.png",
    "booyah/images/fullscreen-disabled.png",
    "booyah/images/lang-en-off.png",
    "booyah/images/lang-en-on.png",
    "booyah/images/lang-fr-off.png",
    "booyah/images/lang-fr-on.png",
    "booyah/images/music-off.png",
    "booyah/images/music-on.png",
    "booyah/images/subtitles-off.png",
    "booyah/images/subtitles-on.png",
    "booyah/images/voices-off.png",
    "booyah/images/voices-on.png",
];
/** String of characters to look for in a font */
const FONT_OBSERVER_CHARS = "asdf";
const PRELOADER_ASSETS = [
    "booyah/images/loader-circle.png",
    "booyah/images/loader-error.png",
];
const LOADING_SCENE_SPIN_SPEED = Math.PI / 60; // One spin in 2s
const rootConfig = {
    directives: null,
    app: null,
    preloader: null,
    container: null,
    playOptions: null,
    musicAudio: {},
    videoAssets: {},
    jsonAssets: {},
    fxAudio: null,
    gameStateMachine: null,
    menu: null,
    muted: null,
    jukebox: null,
    narrator: null,
    world: null,
};
let loadingScene;
let rootEntity;
let lastFrameTime = 0;
let previousGameState = null;
let gameState = "preloading";
let playTime = 0;
let timeSinceStart = 0;
let pixiLoaderProgress = 0;
let fontLoaderProgress = 0;
let fixedAudioLoaderProgress = 0;
let videoLoaderProgress = 0;
let variableAudioLoaderProgress = 0;
// Only send updates on non-paused entties
class FilterPauseEntity extends entity.ParallelEntity {
    update(frameInfo) {
        if (frameInfo.gameState == "playing")
            super.update(frameInfo);
    }
}
class PlayOptions extends PIXI.utils.EventEmitter {
    constructor(directives, searchUrl) {
        super();
        this.options = {
            musicOn: true,
            fxOn: true,
            showSubtitles: true,
            sceneParams: directives.startingSceneParams,
            scene: directives.startingScene,
            startingProgress: directives.startingProgress,
        };
        const searchParams = new URLSearchParams(searchUrl);
        if (searchParams.has("music"))
            this.options.musicOn = util.stringToBool(searchParams.get("music"));
        if (searchParams.has("fx"))
            this.options.fxOn = util.stringToBool(searchParams.get("fx"));
        if (searchParams.has("subtitles"))
            this.options.showSubtitles = util.stringToBool(searchParams.get("subtitles"));
        if (searchParams.has("scene"))
            this.options.scene = searchParams.get("scene");
        if (searchParams.has("params"))
            this.options.sceneParams = JSON.parse(searchParams.get("params"));
        if (searchParams.has("progress"))
            this.options.startingProgress = JSON.parse(searchParams.get("progress"));
        if (searchParams.has("mute") &&
            util.stringToBool(searchParams.get("mute"))) {
            this.options.musicOn = false;
            this.options.fxOn = false;
        }
    }
    setOption(name, value) {
        //@ts-ignore
        this.options[name] = value;
        this.emit(name, value);
        this.emit("change", name, value);
    }
    getOption(name) {
        //@ts-ignore
        return this.options[name];
    }
}
exports.PlayOptions = PlayOptions;
class MenuEntity extends entity.ParallelEntity {
    _setup(frameInfo, entityConfig) {
        this.container = new PIXI.Container();
        this.container.name = "menu";
        this.creditsEntity = null;
        this.pauseButton = new PIXI.Sprite(this.entityConfig.app.loader.resources[this.entityConfig.directives.graphics.menu].texture);
        this.pauseButton.anchor.set(0.5);
        if (this.entityConfig.directives.menuButtonPosition) {
            this.pauseButton.position = this.entityConfig.directives.menuButtonPosition;
        }
        else {
            this.pauseButton.position.set(this.entityConfig.app.renderer.width - 50, 50);
        }
        this.pauseButton.interactive = true;
        this._on(this.pauseButton, "pointertap", this._onPause);
        this.container.addChild(this.pauseButton);
        this.menuLayer = new PIXI.Container();
        this.menuLayer.visible = false;
        this.container.addChild(this.menuLayer);
        this.mask = new PIXI.Graphics();
        this.mask.beginFill(0x000000);
        this.mask.drawRect(0, 0, this.entityConfig.app.screen.width, this.entityConfig.app.screen.height);
        this.mask.endFill();
        this.mask.alpha = 0.8;
        this.mask.interactive = true;
        this.menuLayer.addChild(this.mask);
        this.menuButtonLayer = new PIXI.Container();
        this.menuLayer.addChild(this.menuButtonLayer);
        this.playButton = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/button-close.png"].texture);
        this.playButton.anchor.set(0.5);
        this.playButton.position.set(this.entityConfig.app.renderer.width - 50, 50);
        this.playButton.interactive = true;
        this._on(this.playButton, "pointertap", this._onPlay);
        this.menuButtonLayer.addChild(this.playButton);
        const menuButtonLayerConfig = {
            ...this.entityConfig,
            container: this.menuButtonLayer,
        };
        if (this.entityConfig.directives.gameLogo) {
            const gameLogo = new PIXI.Sprite(this.entityConfig.preloader.resources[this.entityConfig.directives.gameLogo].texture);
            gameLogo.position.set(170, 200);
            gameLogo.anchor.set(0.5, 0.5);
            this.menuButtonLayer.addChild(gameLogo);
        }
        const pcLogo = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/a-playcurious-game.png"].texture);
        pcLogo.anchor.set(0.5, 1);
        pcLogo.position.set(170, 450);
        this.menuButtonLayer.addChild(pcLogo);
        if (this.entityConfig.directives.extraLogos) {
            // Divide space, align to the right
            const spacePerLogo = (this.entityConfig.app.renderer.width - 160 * 2) /
                this.entityConfig.directives.extraLogos.length;
            for (let i = 0; i < this.entityConfig.directives.extraLogos.length; i++) {
                const logoSprite = new PIXI.Sprite(this.entityConfig.app.loader.resources[this.entityConfig.directives.extraLogos[i]].texture);
                logoSprite.anchor.set(0.5, 1);
                logoSprite.position.set(this.entityConfig.app.renderer.width - 160 - spacePerLogo * i, 420);
                this.menuButtonLayer.addChild(logoSprite);
            }
        }
        if (util.supportsFullscreen(document.getElementById("game-parent"))) {
            this.fullScreenButton = new entity.ToggleSwitch({
                onTexture: this.entityConfig.app.loader.resources["booyah/images/fullscreen-on.png"].texture,
                offTexture: this.entityConfig.app.loader.resources["booyah/images/fullscreen-off.png"].texture,
                isOn: false,
                position: new PIXI.Point(405, 130),
            });
            this._on(this.fullScreenButton, "change", this._onChangeFullScreen);
            this.fullScreenButton.setup(frameInfo, menuButtonLayerConfig);
            this.addEntity(this.fullScreenButton);
            // TODO: use event listener to check if full screen was exited manually with ESC key
        }
        else {
            const fullScreenButton = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/fullscreen-disabled.png"].texture);
            fullScreenButton.position.set(405, 130);
            this.menuButtonLayer.addChild(fullScreenButton);
        }
        this.musicButton = new entity.ToggleSwitch({
            onTexture: this.entityConfig.app.loader.resources["booyah/images/music-on.png"].texture,
            offTexture: this.entityConfig.app.loader.resources["booyah/images/music-off.png"].texture,
            isOn: this.entityConfig.playOptions.options.musicOn,
            position: new PIXI.Point(405, 230),
        });
        this._on(this.musicButton, "change", this._onChangeMusicIsOn);
        this.musicButton.setup(frameInfo, menuButtonLayerConfig);
        this.addEntity(this.musicButton);
        // TODO prevent being able to turn both subtitles and sound off
        this.fxButton = new entity.ToggleSwitch({
            onTexture: this.entityConfig.app.loader.resources["booyah/images/voices-on.png"].texture,
            offTexture: this.entityConfig.app.loader.resources["booyah/images/voices-off.png"].texture,
            isOn: this.entityConfig.playOptions.options.fxOn,
            position: new PIXI.Point(630, 230),
        });
        this._on(this.fxButton, "change", this._onChangeFxIsOn);
        this.fxButton.setup(frameInfo, menuButtonLayerConfig);
        this.addEntity(this.fxButton);
        this.subtitlesButton = new entity.ToggleSwitch({
            onTexture: this.entityConfig.app.loader.resources["booyah/images/subtitles-on.png"].texture,
            offTexture: this.entityConfig.app.loader.resources["booyah/images/subtitles-off.png"].texture,
            isOn: this.entityConfig.playOptions.options.showSubtitles,
            position: new PIXI.Point(630, 130),
        });
        this._on(this.subtitlesButton, "change", this._onChangeShowSubtitles);
        this.subtitlesButton.setup(frameInfo, menuButtonLayerConfig);
        this.addEntity(this.subtitlesButton);
        const creditLink = new PIXI.Text("Credits", {
            fontFamily: "Roboto Condensed",
            fontSize: 32,
            fill: "white",
            strokeThickness: 4,
        });
        creditLink.anchor.set(0.5, 0.5);
        creditLink.position.set(this.entityConfig.app.renderer.width / 2 - 10, 492);
        creditLink.interactive = true;
        this._on(creditLink, "pointertap", this._showCredits);
        this.menuButtonLayer.addChild(creditLink);
        // Language switching buttons
        if (this.entityConfig.directives.supportedLanguages) {
            for (let i = 0; i < this.entityConfig.directives.supportedLanguages.length; i++) {
                const language = this.entityConfig.directives.supportedLanguages[i];
                const isSelected = language === this.entityConfig.directives.language;
                const sprite = new PIXI.Sprite(this.entityConfig.app.loader.resources[`booyah/images/lang-${language}-${isSelected ? "off" : "on"}.png`].texture);
                sprite.position.set(405 + i * 100, 330);
                if (!isSelected) {
                    sprite.interactive = true;
                    this._on(sprite, "pointertap", () => this._onSwitchLanguage(language));
                }
                this.menuButtonLayer.addChild(sprite);
            }
            this.switchLanguageConfirmLayer = new PIXI.Container();
            this.switchLanguageConfirmLayer.visible = false;
            this.menuLayer.addChild(this.switchLanguageConfirmLayer);
            const mask = new PIXI.Graphics();
            mask.beginFill(0x000000);
            mask.drawRect(0, 0, this.entityConfig.app.screen.width, this.entityConfig.app.screen.height);
            mask.endFill();
            mask.alpha = 0.8;
            mask.interactive = true;
            this.switchLanguageConfirmLayer.addChild(mask);
            this.confirmLanguageButton = new PIXI.Sprite();
            this.confirmLanguageButton.anchor.set(0.5);
            this.confirmLanguageButton.scale.set(1.5);
            this.confirmLanguageButton.position.set(this.entityConfig.app.renderer.width / 2, this.entityConfig.app.renderer.height / 2);
            this.confirmLanguageButton.interactive = true;
            // Event handler is added later, in _onSwitchLanguage()
            this.switchLanguageConfirmLayer.addChild(this.confirmLanguageButton);
            const cancelSwitchLanguageButton = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/button-back.png"].texture);
            cancelSwitchLanguageButton.anchor.set(0.5);
            cancelSwitchLanguageButton.position.set(50);
            cancelSwitchLanguageButton.interactive = true;
            this._on(cancelSwitchLanguageButton, "pointertap", this._onCancelSwitchLanguage);
            this.switchLanguageConfirmLayer.addChild(cancelSwitchLanguageButton);
        }
        // Restart button
        {
            this.resetButton = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/button-replay.png"].texture);
            this.resetButton.scale.set(0.58); // From 102 to 60 px
            this.resetButton.anchor.set(0.5);
            this.resetButton.position.set(50, 50);
            this.resetButton.interactive = true;
            this._on(this.resetButton, "pointertap", this._onReset);
            this.menuButtonLayer.addChild(this.resetButton);
            this.resetConfirmLayer = new PIXI.Container();
            this.resetConfirmLayer.visible = false;
            this.menuLayer.addChild(this.resetConfirmLayer);
            this.resetMask = new PIXI.Graphics();
            this.resetMask.beginFill(0x000000);
            this.resetMask.drawRect(0, 0, this.entityConfig.app.screen.width, this.entityConfig.app.screen.height);
            this.resetMask.endFill();
            this.resetMask.alpha = 0.8;
            this.resetMask.interactive = true;
            this.resetConfirmLayer.addChild(this.resetMask);
            this.confirmResetButton = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/button-replay.png"].texture);
            this.confirmResetButton.anchor.set(0.5);
            this.confirmResetButton.position.set(this.entityConfig.app.renderer.width / 2, this.entityConfig.app.renderer.height / 2);
            this.confirmResetButton.interactive = true;
            this._on(this.confirmResetButton, "pointertap", this._onConfirmReset);
            this.resetConfirmLayer.addChild(this.confirmResetButton);
            const cancelResetButton = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/button-back.png"].texture);
            cancelResetButton.anchor.set(0.5);
            cancelResetButton.position.set(50);
            cancelResetButton.interactive = true;
            this._on(cancelResetButton, "pointertap", this._onCancelReset);
            this.resetConfirmLayer.addChild(cancelResetButton);
        }
        this.entityConfig.container.addChild(this.container);
    }
    _update(frameInfo) {
        if (this.creditsEntity) {
            if (this.creditsEntity.requestedTransition) {
                this.removeEntity(this.creditsEntity);
                this.creditsEntity = null;
            }
        }
    }
    _teardown() {
        this.entityConfig.container.removeChild(this.container);
    }
    _onPause() {
        this.pauseButton.visible = false;
        this.menuLayer.visible = true;
        this.emit("pause");
    }
    _onPlay() {
        this.pauseButton.visible = true;
        this.menuLayer.visible = false;
        this.emit("play");
    }
    _onChangeFullScreen(turnOn) {
        if (turnOn)
            util.requestFullscreen(document.getElementById("game-parent"));
        else
            util.exitFullscreen();
    }
    _onChangeMusicIsOn(isOn) {
        this.entityConfig.playOptions.setOption("musicOn", isOn);
    }
    _onChangeFxIsOn(isOn) {
        this.entityConfig.playOptions.setOption("fxOn", isOn);
    }
    _onChangeShowSubtitles(showSubtitles) {
        this.entityConfig.playOptions.setOption("showSubtitles", showSubtitles);
    }
    _onReset() {
        this.resetConfirmLayer.visible = true;
    }
    _onCancelReset() {
        this.resetConfirmLayer.visible = false;
    }
    _onConfirmReset() {
        this.pauseButton.visible = true;
        this.menuLayer.visible = false;
        this.resetConfirmLayer.visible = false;
        this.emit("reset");
    }
    _showCredits() {
        this.creditsEntity = new CreditsEntity();
        this.addEntity(this.creditsEntity);
    }
    _onSwitchLanguage(language) {
        this.confirmLanguageButton.texture = this.entityConfig.app.loader.resources[`booyah/images/lang-${language}-on.png`].texture;
        this._on(this.confirmLanguageButton, "pointertap", () => this._onConfirmSwitchLanguage(language));
        this.switchLanguageConfirmLayer.visible = true;
    }
    _onConfirmSwitchLanguage(language) {
        // Make URL with a different language
        // IDEA: use the current progress of the game, from the game state machine?
        const url = new URL(window.location.href);
        url.searchParams.set("lang", language);
        //@ts-ignore
        window.location = url;
    }
    _onCancelSwitchLanguage() {
        this._off(this.confirmLanguageButton, "pointertap");
        this.switchLanguageConfirmLayer.visible = false;
    }
}
exports.MenuEntity = MenuEntity;
function installMenu(rootConfig, rootEntity) {
    rootConfig.menu = new MenuEntity();
    rootEntity.addEntity(rootConfig.menu);
}
exports.installMenu = installMenu;
class CreditsEntity extends entity.ParallelEntity {
    _setup(entityConfig) {
        this.container = new PIXI.Container();
        let rolesText = "";
        let peopleText = "";
        let didFirstLine = false;
        for (let role in this.entityConfig.directives.credits) {
            if (didFirstLine) {
                rolesText += "\n";
                peopleText += "\n";
            }
            else {
                didFirstLine = true;
            }
            rolesText += role;
            // Their could be one person credited (string), or an array
            const people = Array.isArray(this.entityConfig.directives.credits[role])
                ? this.entityConfig.directives.credits[role]
                : [this.entityConfig.directives.credits[role]];
            for (let person of people) {
                rolesText += "\n";
                peopleText += person + "\n";
            }
        }
        const mask = new PIXI.Graphics();
        mask.beginFill(0x000000);
        mask.drawRect(0, 0, this.entityConfig.app.screen.width, this.entityConfig.app.screen.height);
        mask.endFill();
        mask.alpha = 0.8;
        mask.interactive = true;
        this.container.addChild(mask);
        const closeButton = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/button-back.png"].texture);
        closeButton.anchor.set(0.5);
        closeButton.position.set(50);
        closeButton.interactive = true;
        this._on(closeButton, "pointertap", () => (this.requestedTransition = true));
        this.container.addChild(closeButton);
        const roles = new PIXI.Text(rolesText, {
            fontFamily: "Roboto Condensed",
            fontSize: this.entityConfig.directives.creditsTextSize,
            fill: "white",
            align: "right",
        });
        roles.anchor.set(1, 0.5);
        roles.position.set(this.entityConfig.app.renderer.width / 2 - 10, this.entityConfig.app.renderer.height / 2);
        this.container.addChild(roles);
        const people = new PIXI.Text(peopleText, {
            fontFamily: "Roboto Condensed",
            fontSize: this.entityConfig.directives.creditsTextSize,
            fill: "white",
            align: "left",
        });
        people.anchor.set(0, 0.5);
        people.position.set(this.entityConfig.app.renderer.width / 2 + 10, this.entityConfig.app.renderer.height / 2);
        this.container.addChild(people);
        this.entityConfig.container.addChild(this.container);
    }
    _teardown() {
        this.entityConfig.container.removeChild(this.container);
    }
}
exports.CreditsEntity = CreditsEntity;
class LoadingScene extends entity.ParallelEntity {
    _setup() {
        this.progress = 0;
        this.shouldUpdateProgress = true;
        this.container = new PIXI.Container();
        if (this.entityConfig.directives.splashScreen) {
            this.container.addChild(new PIXI.Sprite(this.entityConfig.preloader.resources[this.entityConfig.directives.splashScreen].texture));
        }
        this.loadingContainer = new PIXI.Container();
        this.container.addChild(this.loadingContainer);
        this.loadingFill = new PIXI.Graphics();
        this.loadingFill.position.set(this.entityConfig.app.screen.width / 2 - 50, (this.entityConfig.app.screen.height * 3) / 4 - 50);
        this.loadingContainer.addChild(this.loadingFill);
        const loadingFillMask = new PIXI.Graphics();
        loadingFillMask.beginFill(0xffffff);
        loadingFillMask.drawCircle(0, 0, 50);
        loadingFillMask.endFill();
        loadingFillMask.position.set(this.entityConfig.app.screen.width / 2, (this.entityConfig.app.screen.height * 3) / 4);
        this.loadingContainer.addChild(loadingFillMask);
        this.loadingFill.mask = loadingFillMask;
        this.loadingCircle = new PIXI.Sprite(this.entityConfig.preloader.resources["booyah/images/loader-circle.png"].texture);
        this.loadingCircle.anchor.set(0.5);
        this.loadingCircle.position.set(this.entityConfig.app.screen.width / 2, (this.entityConfig.app.screen.height * 3) / 4);
        this.loadingContainer.addChild(this.loadingCircle);
        this.entityConfig.container.addChild(this.container);
    }
    _update(frameInfo) {
        this.loadingCircle.rotation +=
            LOADING_SCENE_SPIN_SPEED * frameInfo.timeScale;
        if (this.shouldUpdateProgress) {
            const height = this.progress * 100; // Because the graphic happens to be 100px tall
            this.loadingFill.clear();
            this.loadingFill.beginFill(0xffffff);
            this.loadingFill.drawRect(0, 100, 100, -height);
            this.loadingFill.endFill();
            this.shouldUpdateProgress = false;
        }
    }
    _teardown(frameInfo) {
        this.entityConfig.container.removeChild(this.container);
    }
    updateProgress(fraction) {
        this.progress = fraction;
        this.shouldUpdateProgress = true;
    }
}
exports.LoadingScene = LoadingScene;
class ReadyScene extends entity.ParallelEntity {
    _setup() {
        this.container = new PIXI.Container();
        if (this.entityConfig.directives.splashScreen) {
            this.container.addChild(new PIXI.Sprite(this.entityConfig.preloader.resources[this.entityConfig.directives.splashScreen].texture));
        }
        const button = new PIXI.Sprite(this.entityConfig.app.loader.resources[this.entityConfig.directives.graphics.play].texture);
        button.anchor.set(0.5);
        button.position.set(this.entityConfig.app.screen.width / 2, (this.entityConfig.app.screen.height * 3) / 4);
        this._on(button, "pointertap", () => (this.requestedTransition = true));
        button.interactive = true;
        this.container.addChild(button);
        this.entityConfig.container.addChild(this.container);
    }
    _teardown() {
        this.entityConfig.container.removeChild(this.container);
    }
}
exports.ReadyScene = ReadyScene;
class LoadingErrorScene extends entity.ParallelEntity {
    _setup() {
        this.container = new PIXI.Container();
        if (this.entityConfig.directives.splashScreen) {
            this.container.addChild(new PIXI.Sprite(this.entityConfig.preloader.resources[this.entityConfig.directives.splashScreen].texture));
        }
        const button = new PIXI.Sprite(this.entityConfig.preloader.resources["booyah/images/loader-error.png"].texture);
        button.anchor.set(0.5);
        button.position.set(this.entityConfig.app.screen.width / 2, (this.entityConfig.app.screen.height * 3) / 4);
        this.container.addChild(button);
        this.entityConfig.container.addChild(this.container);
    }
    _teardown() {
        this.entityConfig.container.removeChild(this.container);
    }
}
exports.LoadingErrorScene = LoadingErrorScene;
class DoneScene extends entity.ParallelEntity {
    _setup() {
        this.container = new PIXI.Container();
        if (this.entityConfig.directives.splashScreen) {
            this.container.addChild(new PIXI.Sprite(this.entityConfig.preloader.resources[this.entityConfig.directives.splashScreen].texture));
        }
        const button = new PIXI.Sprite(this.entityConfig.app.loader.resources["booyah/images/button-replay.png"].texture);
        button.anchor.set(0.5);
        button.position.set(this.entityConfig.app.screen.width / 2, (this.entityConfig.app.screen.height * 3) / 4);
        this._on(button, "pointertap", () => (this.requestedTransition = true));
        button.interactive = true;
        this.container.addChild(button);
        this.entityConfig.container.addChild(this.container);
    }
    _teardown() {
        this.entityConfig.container.removeChild(this.container);
    }
}
exports.DoneScene = DoneScene;
function updateLoadingProgress() {
    const progress = (pixiLoaderProgress +
        fontLoaderProgress +
        fixedAudioLoaderProgress +
        variableAudioLoaderProgress +
        videoLoaderProgress) /
        5;
    console.debug("loading progress", progress, {
        pixiLoaderProgress,
        fontLoaderProgress,
        fixedAudioLoaderProgress,
        variableAudioLoaderProgress,
        videoLoaderProgress,
    });
    if (loadingScene)
        loadingScene.updateProgress(progress);
}
function pixiLoadProgressHandler(loader, resource) {
    pixiLoaderProgress = loader.progress / 100;
    updateLoadingProgress();
}
function update(timeScale) {
    const frameTime = Date.now();
    const timeSinceLastFrame = frameTime - lastFrameTime;
    lastFrameTime = frameTime;
    // Only count "play time" as compared to clock time
    if (gameState == "playing") {
        playTime += timeSinceLastFrame;
        timeSinceStart += timeSinceLastFrame;
    }
    const frameInfo = {
        playTime,
        timeSinceStart,
        timeSinceLastFrame,
        timeScale,
        gameState,
    };
    if (previousGameState !== gameState) {
        if (previousGameState == "playing" && gameState == "paused") {
            rootEntity.onSignal(frameInfo, "pause");
        }
        else if (previousGameState == "paused" && gameState == "playing") {
            rootEntity.onSignal(frameInfo, "play");
        }
        previousGameState = gameState;
    }
    rootEntity.update(frameInfo);
    rootConfig.app.renderer.render(rootConfig.app.stage);
}
function changeGameState(newGameState) {
    console.log("switching from game state", gameState, "to", newGameState);
    gameState = newGameState;
    util.sendMetrics("send", "event", "changeGameState", newGameState);
}
function loadFixedAssets() {
    changeGameState("loadingFixed");
    util.endTiming("preload");
    util.startTiming("loadFixed");
    // Load graphical assets
    const pixiLoaderResources = [].concat(GRAPHICAL_ASSETS, Object.values(rootConfig.directives.graphics), rootConfig.directives.graphicalAssets);
    rootConfig.app.loader.add(pixiLoaderResources);
    rootConfig.app.loader.onProgress.add(pixiLoadProgressHandler);
    const fonts = ["Roboto Condensed", ...rootConfig.directives.fontAssets];
    const fontLoaderPromises = fonts.map((name) => {
        return new fontfaceobserver_1.default(name)
            .load(FONT_OBSERVER_CHARS)
            .then(() => {
            fontLoaderProgress += 1 / fonts.length;
            updateLoadingProgress();
        })
            .catch((e) => {
            console.error("Cannot load font", name);
            throw e;
        });
    });
    rootConfig.jsonAssets = {};
    const jsonLoaderPromises = rootConfig.directives.jsonAssets.map((jsonAssetDescription) => {
        if (typeof jsonAssetDescription === "string") {
            return util.loadJson(jsonAssetDescription).then((data) => {
                rootConfig.jsonAssets[jsonAssetDescription] = data;
            });
        }
        else if (typeof jsonAssetDescription === "object" &&
            jsonAssetDescription.key &&
            jsonAssetDescription.url) {
            return util.loadJson(jsonAssetDescription.url).then((data) => {
                rootConfig.jsonAssets[jsonAssetDescription.key] = data;
            });
        }
        else {
            throw new Error(`Unrecognized JSON asset description '${JSON.stringify(jsonAssetDescription)}'`);
        }
    });
    // Load audio
    rootConfig.musicAudio = audio.makeHowls("music", rootConfig.directives.musicAssets);
    const musicLoadPromises = rootConfig.musicAudio.map(audio.makeHowlerLoadPromise);
    rootConfig.fxAudio = audio.makeHowls("fx", rootConfig.directives.fxAssets);
    const fxLoadPromises = rootConfig.fxAudio.map(audio.makeHowlerLoadPromise);
    const fixedAudioLoaderPromises = [...musicLoadPromises, ...fxLoadPromises];
    fixedAudioLoaderPromises.forEach((p) => p.then(() => {
        fixedAudioLoaderProgress += 1 / fixedAudioLoaderPromises.length;
        updateLoadingProgress();
    }));
    // Load video
    const videoLoaderPromises = [];
    if (rootConfig.directives.videoAssets.length > 0) {
        const videoLoader = preload_it_esm_1.default();
        videoLoader.onprogress = (event) => {
            videoLoaderProgress = event.progress / 100;
            updateLoadingProgress();
        };
        videoLoaderPromises.push(videoLoader
            .fetch(rootConfig.directives.videoAssets.map((name) => `video/${name}`))
            .then((assets) => {
            const videoAssets = {};
            for (const asset of assets) {
                const element = util.makeVideoElement();
                element.src = asset.blobUrl;
                videoAssets[asset.url] = element;
            }
            rootConfig.videoAssets = videoAssets;
        })
            .catch((e) => {
            console.error("Cannot load videos", e);
            throw e;
        }));
    }
    const promises = [
        util.makePixiLoadPromise(rootConfig.app.loader),
        fontLoaderPromises,
        fixedAudioLoaderPromises,
        jsonLoaderPromises,
        videoLoaderPromises,
    ].flat(1);
    return Promise.all(promises).catch((err) => {
        console.error("Error loading fixed assets", err);
        throw err;
    });
}
function loadVariable() {
    util.endTiming("loadFixed");
    util.startTiming("loadVariable");
    const loadingPromises = [];
    for (const loader of rootConfig.directives.extraLoaders) {
        // TODO: handle progress
        const newPromise = loader(rootConfig);
        loadingPromises.push(newPromise);
    }
    return Promise.all(loadingPromises).catch((err) => {
        console.error("Error in variable loading stage", err);
        throw err;
    });
    // // Load audio
    // narrationAudio = narration.loadNarrationAudio(narrationTable, "fr");
    // const narrationLoadPromises = Array.from(
    //   narrationAudio.values(),
    //   audio.makeHowlerLoadPromise
    // );
    // narrationLoadPromises.forEach( p =>
    //   p.then(() => {
    //     variableAudioLoaderProgress += 1 / narrationLoadPromises.length;
    //     updateLoadingProgress();
    //   })
    // );
    // return Promise.all(narrationLoadPromises).catch(err =>
    //   console.error("Error loading C", err)
    // );
}
function doneLoading() {
    const frameInfo = {
        playTime: 0,
        timeSinceStart: 0,
        timeSinceLastFrame: 0,
        timeScale: 1,
        gameState,
    };
    util.endTiming("loadVariable");
    util.startTiming("playing");
    changeGameState("playing");
    // Remove loading screen
    loadingScene.teardown(frameInfo);
    loadingScene = null;
    rootEntity = null;
    // The new rootEntity will contain all the sub entities
    rootEntity = new entity.ParallelEntity();
    // gameSequence will have the ready and done scenes
    const gameSequence = new entity.EntitySequence([new ReadyScene(), rootConfig.gameStateMachine, new DoneScene()], { loop: true });
    // Filter out the pause event for the game sequence
    rootEntity.addEntity(new FilterPauseEntity([
        new entity.ContainerEntity([gameSequence], "gameSequence"),
    ]));
    for (const installer of rootConfig.directives.entityInstallers) {
        installer(rootConfig, rootEntity);
    }
    if (rootConfig.menu) {
        rootConfig.menu.on("pause", () => changeGameState("paused"));
        rootConfig.menu.on("play", () => changeGameState("playing"));
        rootConfig.menu.on("reset", () => {
            rootEntity.onSignal(rootConfig.menu.lastFrameInfo, "reset");
            changeGameState("playing");
        });
    }
    rootEntity.setup(frameInfo, rootConfig);
}
function makePreloader(additionalAssets) {
    const loader = new PIXI.Loader();
    loader.add(PRELOADER_ASSETS);
    loader.add(additionalAssets);
    return loader;
}
exports.makePreloader = makePreloader;
function go(directives = {}) {
    Object.assign(rootConfig, directives.rootConfig);
    rootConfig.directives = util.deepDefaults(directives, DEFAULT_DIRECTIVES);
    // Process starting options
    rootConfig.playOptions = new PlayOptions(rootConfig.directives, window.location.search);
    rootConfig.gameStateMachine = new entity.StateMachine(rootConfig.directives.states, rootConfig.directives.transitions, {
        startingState: rootConfig.playOptions.options.scene,
        startingStateParams: rootConfig.playOptions.options.sceneParams,
        startingProgress: rootConfig.playOptions.options.startingProgress,
        endingStates: rootConfig.directives.endingScenes,
    });
    rootConfig.gameStateMachine.on("stateChange", onGameStateMachineChange);
    rootConfig.app = new PIXI.Application({
        width: rootConfig.directives.screenSize.x,
        height: rootConfig.directives.screenSize.y,
        view: document.getElementById(rootConfig.directives.canvasId),
    });
    rootConfig.container = rootConfig.app.stage;
    util.sendMetrics("send", "event", "loading", "start");
    util.startTiming("preload");
    // Setup preloader
    rootConfig.preloader = makePreloader([rootConfig.directives.splashScreen, rootConfig.directives.gameLogo].filter((e) => !!e));
    const frameInfo = {
        playTime: 0,
        timeSinceStart: 0,
        timeSinceLastFrame: 0,
        timeScale: 1,
        gameState,
    };
    const loadingPromise = Promise.all([
        util.makeDomContentLoadPromise(document),
        util.makePixiLoadPromise(rootConfig.preloader),
    ])
        .then(() => {
        // Show loading screen as soon as preloader is done
        loadingScene = new LoadingScene();
        rootEntity = loadingScene;
        // The loading scene doesn't get the full entityConfig
        loadingScene.setup(frameInfo, rootConfig);
        rootConfig.app.ticker.add(update);
    })
        .then(() => loadFixedAssets())
        .then(loadVariable)
        .then(doneLoading)
        .catch((err) => {
        console.error("Error during load", err);
        // Replace loading scene with loading error
        loadingScene.teardown(frameInfo);
        loadingScene = null;
        rootEntity = new LoadingErrorScene();
        rootEntity.setup(frameInfo, rootConfig);
        throw err;
    });
    return {
        rootConfig,
        rootEntity,
        loadingPromise,
    };
}
exports.go = go;
function onGameStateMachineChange(nextStateName, nextStateParams, previousStateName, previousStateParams) {
    const url = new URL(window.location.href);
    nextStateParams = nextStateParams
        ? removePrivateProperties(nextStateParams)
        : {};
    url.searchParams.set("scene", nextStateName);
    url.searchParams.set("params", JSON.stringify(nextStateParams));
    url.searchParams.set("progress", JSON.stringify(rootConfig.gameStateMachine.progress));
    console.log("New game state:", nextStateName, nextStateParams);
    console.log("New game state link:", url.href);
}
function removePrivateProperties(obj) {
    const result = {};
    for (const key in obj) {
        if (!key.startsWith("_"))
            result[key] = obj[key];
    }
    return result;
}
