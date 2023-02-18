/// <reference path="options.ts" />

const breakTitle = chrome.i18n.getMessage("breakTitle");
const breakContent = (s: string): string => chrome.i18n.getMessage("breakContent", s);
const reminderTitle = chrome.i18n.getMessage("reminderTitle");
const reminderContent = chrome.i18n.getMessage("reminderContent");
const pauseIconUrls = ["icons/icons8_pause_64px.png", "icons/icons8_Body_Positive_Female_64px_1.png", "icons/jumping-man.png"];

class PauseScreen {
  settings: PauseScreenSettings = null;
  timeWithoutBreak: number = 0;
  lastStateChangeTimestamp: number = 0;

  init(settings: PauseScreenSettings): void {
    chrome.idle.setDetectionInterval(60);
    chrome.storage.onChanged.addListener(this.onSettingsChanged);
    chrome.idle.onStateChanged.addListener(this.onStateChanged);
    chrome.alarms.onAlarm.addListener(this.onAlarmFired);
    chrome.browserAction.onClicked.addListener(() => {
      chrome.runtime.openOptionsPage();
    });
    this.lastStateChangeTimestamp = Date.now();
    chrome.alarms.create("reminder_alarm", { periodInMinutes: settings.remindInterval });
  }
  onStateChanged(newState: string): void {
    let now: Date = new Date();
    const timeForLogging = pauseReminder.getTimeForLogging();
    // // console.log(`${timeForLogging}: state change, new state ${newState}`);

    // Calculate time difference
    let diff: number = now.getTime() - pauseReminder.lastStateChangeTimestamp;
    let minutes: number = Math.round(diff / (1000 * 60));

    // Change behaviour based on new state
    if (newState != "active") {
      pauseReminder.timeWithoutBreak += Math.round((now.getTime() - pauseReminder.lastStateChangeTimestamp) / (60 * 1000));
      chrome.alarms.clearAll();
    } else if (newState == "active") {
      if (minutes >= pauseReminder.settings.breakDuration - 1) {
        // because 1 minute passes before we go in idle state
        // console.log(`${timeForLogging}: away for  ${(diff / (1000 * 60)).toString()} min reseting break timer`);
        pauseReminder.timeWithoutBreak = 0;
      } else {
        // console.log(`${timeForLogging} short break for  ${minutes.toString()}  minutes`);
        pauseReminder.timeWithoutBreak -= minutes;
      }
      chrome.alarms.create("reminder_alarm", { periodInMinutes: pauseReminder.settings.remindInterval });
    }
    pauseReminder.lastStateChangeTimestamp = now.getTime();
  }
  onAlarmFired(alarm: chrome.alarms.Alarm): void {
    const timeForLogging = pauseReminder.getTimeForLogging();
    pauseReminder.timeWithoutBreak += pauseReminder.settings.remindInterval;
    if (pauseReminder.timeWithoutBreak >= pauseReminder.settings.breakInterval) {
      // console.log(`${timeForLogging}: Long Break, without break since : ${pauseReminder.timeWithoutBreak.toString()} minutes`);
      chrome.notifications.create("pause", {
        type: "basic",
        title: breakTitle,
        iconUrl: "icons/icons8_stretching_64px.png",
        message: breakContent(pauseReminder.settings.breakDuration.toString()),
      });
    } else {
      // console.log(`${timeForLogging}:  Short Pause, without break since  ${pauseReminder.timeWithoutBreak.toString()} minutes`);
      let randomIcon = pauseIconUrls[Math.floor(Math.random() * pauseIconUrls.length)];
      chrome.notifications.create("pause", {
        type: "basic",
        title: reminderTitle,
        iconUrl: randomIcon,
        message: reminderContent,
      });
    }
  }
  loadSettings(): void {
    const settings = {
      remindInterval: 20,
      breakInterval: 60,
      breakDuration: 10,
    };

    chrome.storage.local.get(settings, (s: PauseScreenSettings) => {
      if (!chrome.runtime.lastError) {
        pauseReminder.settings = s;
        pauseReminder.init(s);
      } else {
        console.error(`Error loading settings ${chrome.runtime.lastError.message}`);
      }
    });
  }
  onSettingsChanged(change: { [key: string]: chrome.storage.StorageChange }, area: string): void {
    chrome.alarms.clearAll();
    pauseReminder.settings.remindInterval = change["remindInterval"].newValue;
    pauseReminder.settings.breakInterval = change["breakInterval"].newValue;
    pauseReminder.settings.breakDuration = change["breakDuration"].newValue;
    chrome.alarms.create("reminder_alarm", { periodInMinutes: pauseReminder.settings.remindInterval });
  }
  getTimeForLogging(): string {
    const now: Date = new Date();
    const hours: string = now.getHours() > 9 ? now.getHours().toString() : "0" + now.getHours().toString();
    const minutes: string = now.getMinutes() > 9 ? now.getMinutes().toString() : "0" + now.getMinutes().toString();
    return "[".concat(hours, ":", minutes, "]");
  }
}

const pauseReminder: PauseScreen = new PauseScreen();
pauseReminder.loadSettings();
