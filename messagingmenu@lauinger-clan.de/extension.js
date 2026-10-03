"use strict";

import Shell from "gi://Shell";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as animationUtils from "resource:///org/gnome/shell/misc/animationUtils.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

const EMAIL_ACTION_CANDIDATES = {
    compose: [
        "new-message",
        "new_message",
        "compose",
        "ComposeMessage",
        "ComposeMail",
        "Composer",
        "new-email",
        "new-mail",
    ],
    contacts: ["contacts", "addressbook", "address-book", "OpenAddressBook", "open-address-book"],
    calendar: ["calendar"],
    tasks: ["tasks"],
};

const MessageMenu = GObject.registerClass(
    class MessageMenu_MessageMenu extends PanelMenu.Button {
        constructor(extension) {
            super(0, "MessageMenu");
            this._settings = extension._settings;
            this._extension = extension;
            this._compatible_Chats = this._settings.get_string("compatible-chats").split(";").sort();
            this._compatible_MBlogs = this._settings
                .get_string("compatible-mblogs")
                .split(";")
                .sort(Intl.Collator().compare);
            this._compatible_Emails = this._settings
                .get_string("compatible-emails")
                .split(";")
                .sort(Intl.Collator().compare);
            this._compatibleHiddenEmailNotifiers = this._settings
                .get_string("compatible-hidden-email-notifiers")
                .split(";")
                .sort(Intl.Collator().compare);
            this._compatibleHiddenMBlogNotifiers = this._settings
                .get_string("compatible-hidden-mblog-notifiers")
                .split(";")
                .sort(Intl.Collator().compare);

            const hbox = new St.BoxLayout({
                style_class: "panel-status-menu-box",
            });
            const gicon = Gio.icon_new_for_string(this._extension.path + "/icons/mymail-symbolic.svg");
            this._icon = new St.Icon({
                gicon,
                style_class: "system-status-icon",
            });

            hbox.add_child(this._icon);
            this.add_child(hbox);

            this._availableEmails = [];
            this._availableChats = [];
            this._availableMBlogs = [];
            this._availableNotifiers = [];

            const appsys = Shell.AppSystem.get_default();
            this._getAppsEMAIL(appsys);
            this._getAppsCHAT(appsys);
            this._getAppsBLOG(appsys);
            this._buildEmailMenus();
            this._buildMenu(this._extension);
            this._buttonClickGestures();
        }

        _buttonClickGestures() {
            // make sure the menu opens on left click, and that middle click opens the preferences
            this._clickGesture.required_button = Clutter.BUTTON_PRIMARY;
            const middleClickGesture = new Clutter.ClickGesture({
                required_button: Clutter.BUTTON_MIDDLE,
            });
            middleClickGesture.connect("recognize", () => {
                this.menu.close();
                this._extension.openPreferences();
            });
            this.add_action(middleClickGesture);

            const secondaryClickGesture = new Clutter.ClickGesture({
                required_button: Clutter.BUTTON_SECONDARY,
            });
            secondaryClickGesture.connect("recognize", () => {
                this.menu.toggle();
            });
            this.add_action(secondaryClickGesture);
        }

        createMessageMenuItem(app) {
            const menuItem = new PopupMenu.PopupImageMenuItem(app.get_name(), app.icon.to_string());
            menuItem.connect("activate", () => {
                app.activate();
            });
            return menuItem;
        }

        get AvailableNotifiers() {
            return this._availableNotifiers;
        }

        get compatibleHiddenEmailNotifiers() {
            return this._compatibleHiddenEmailNotifiers;
        }

        get compatibleHiddenMBlogNotifiers() {
            return this._compatibleHiddenMBlogNotifiers;
        }

        _createMessageMenuItemSpecial(label, image) {
            return new PopupMenu.PopupImageMenuItem(label, image, {
                style_class: "special-action",
            });
        }

        _addApplicationMenu(app, actions = []) {
            if (app === null) {
                return;
            }

            this.menu.addMenuItem(this.createMessageMenuItem(app));

            for (const { label, iconName, activate } of actions) {
                const item = this._createMessageMenuItemSpecial(label, iconName);
                item.connect("activate", activate);
                this.menu.addMenuItem(item);
            }
        }

        _buildEmailMenus() {
            for (const app of this._availableEmails) {
                const capabilities = this._getEmailCapabilities(app);
                const actions = [];

                if (capabilities.compose !== null) {
                    const actionId = capabilities.compose;
                    actions.push({
                        label: _("Compose New Message"),
                        iconName: "mail-message-new-symbolic",
                        activate: () => this._launchDesktopAction(app, actionId),
                    });
                }

                if (capabilities.contacts !== null) {
                    const actionId = capabilities.contacts;
                    actions.push({
                        label: _("Contacts"),
                        iconName: "contact-new-symbolic",
                        activate: () => this._launchDesktopAction(app, actionId),
                    });
                }

                if (capabilities.calendar !== null) {
                    const actionId = capabilities.calendar;
                    actions.push({
                        label: _("Calendar"),
                        iconName: "x-office-calendar-symbolic",
                        activate: () => this._launchDesktopAction(app, actionId),
                    });
                }

                if (capabilities.tasks !== null) {
                    const actionId = capabilities.tasks;
                    actions.push({
                        label: _("Tasks"),
                        iconName: "view-list-symbolic",
                        activate: () => this._launchDesktopAction(app, actionId),
                    });
                }

                this._addApplicationMenu(app, actions);
            }
        }

        _buildMenu(extension) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // insert Chat Clients into menu
            for (const c_app of this._availableChats) {
                const newLauncher = this.createMessageMenuItem(c_app);
                this.menu.addMenuItem(newLauncher);
            }
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // insert Blogging Clients into menu
            for (const mb_app of this._availableMBlogs) {
                const newLauncher = this.createMessageMenuItem(mb_app);
                this.menu.addMenuItem(newLauncher);
            }

            // Add an entry-point for settings
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const settingsItem = this.menu.addAction(_("Settings"), () => extension.openPreferences());
            // Ensure the settings are unavailable when the screen is locked
            settingsItem.visible = Main.sessionMode.allowSettings;
            this.menu._settingsActions[extension.uuid] = settingsItem;
        }

        _getAppsEMAIL(appsys) {
            //get available Email Apps
            const seenAppIds = new Set();

            for (const app_name of this._compatible_Emails) {
                const app = appsys.lookup_app(app_name + ".desktop");
                if (app !== null) {
                    const appId = app.get_id();
                    if (seenAppIds.has(appId)) {
                        continue;
                    }

                    seenAppIds.add(appId);
                    this._availableEmails.push(app);
                    if (this._settings.get_boolean("notify-email")) {
                        this._availableNotifiers.push(app);
                    }
                }
            }
        }

        _getAppsCHAT(appsys) {
            //get available Chat Apps
            for (const app_name of this._compatible_Chats) {
                const app = appsys.lookup_app(app_name + ".desktop");

                if (app !== null) {
                    this._availableChats.push(app);
                    if (this._settings.get_boolean("notify-chat")) {
                        this._availableNotifiers.push(app);
                    }
                }
            }
        }

        _getAppsBLOG(appsys) {
            //get available Blogging Apps
            for (const app_name of this._compatible_MBlogs) {
                const app = appsys.lookup_app(app_name + ".desktop");

                if (app !== null) {
                    this._availableMBlogs.push(app);
                    if (this._settings.get_boolean("notify-mblogging")) {
                        this._availableNotifiers.push(app);
                    }
                }
            }
        }

        _normalizeDesktopActionId(actionId) {
            return actionId.toLowerCase().replace(/[^a-z0-9]/g, "");
        }

        _findDesktopAction(actions, candidates) {
            const normalizedCandidates = new Set(
                candidates.map((candidate) => this._normalizeDesktopActionId(candidate))
            );
            return (
                actions.find((actionId) => normalizedCandidates.has(this._normalizeDesktopActionId(actionId))) ?? null
            );
        }

        _getEmailCapabilities(app) {
            const appInfo = app.get_app_info();
            const actions = appInfo === null ? [] : appInfo.list_actions();

            return {
                compose: this._findDesktopAction(actions, EMAIL_ACTION_CANDIDATES.compose),
                contacts: this._findDesktopAction(actions, EMAIL_ACTION_CANDIDATES.contacts),
                calendar: this._findDesktopAction(actions, EMAIL_ACTION_CANDIDATES.calendar),
                tasks: this._findDesktopAction(actions, EMAIL_ACTION_CANDIDATES.tasks),
            };
        }

        _launchDesktopAction(app, actionId) {
            if (app === null) {
                return;
            }

            const appInfo = app.get_app_info();
            const actions = appInfo === null ? [] : appInfo.list_actions();

            if (actions.includes(actionId)) {
                app.launch_action(actionId, 0, -1);
            }
        }

        animate() {
            if (this._settings.get_boolean("wiggle-indicator")) {
                animationUtils.wiggle(this._icon, { offset: 2, duration: 65, wiggleCount: 3 });
            }
        }

        destroy() {
            super.destroy();
        }
    }
);

export default class MessagingMenu extends Extension {
    _updateMessageStatus() {
        // get all Messages
        const sources = Main.messageTray.getSources();
        let newMessage = false;
        for (const source of sources) {
            // check for new Chat Messages
            if (
                this._settings.get_boolean("notify-chat") &&
                source.isChat &&
                !source.isMuted &&
                this._unseenMessageCheck(source)
            ) {
                newMessage = true;
            } else if (source.app) {
                if (this._settings.get_boolean("notify-email")) {
                    newMessage =
                        newMessage ||
                        this._checkNotifyEmailByID(source) ||
                        this._checkHiddenNotifierMatch(source, this._indicator.compatibleHiddenEmailNotifiers);
                }
            } else {
                if (this._settings.get_boolean("notify-email")) {
                    newMessage =
                        newMessage ||
                        this._checkNotifyEmailByName(source) ||
                        this._checkHiddenNotifierMatch(source, this._indicator.compatibleHiddenEmailNotifiers);
                }
                if (this._settings.get_boolean("notify-mblogging")) {
                    newMessage =
                        newMessage ||
                        this._checkHiddenNotifierMatch(source, this._indicator.compatibleHiddenMBlogNotifiers);
                }
            }
        }
        this._changeStatusIcon(newMessage);
    }

    _checkNotifyEmailByID(source) {
        // check for Message from known Email App
        if (source.app) {
            for (const notifier of this._indicator.AvailableNotifiers) {
                const app_id = notifier.get_id(); //e.g. thunderbird.desktop
                if (app_id.toLowerCase().includes(source.app.get_id().toLowerCase())) {
                    return true;
                }
            }
        }
        return false;
    }

    _checkNotifyEmailByName(source) {
        if (source.title) {
            for (const notifier of this._indicator.AvailableNotifiers) {
                const app_name = notifier.get_name(); //e.g. Thunderbird Mail
                if (app_name.toLowerCase().includes(source.title.toLowerCase())) {
                    return true;
                }
            }
        }
        return false;
    }

    _checkHiddenNotifierMatch(source, notifiers) {
        if (source.title) {
            for (const notifier of notifiers) {
                if (notifier.toLowerCase().includes(source.title.toLowerCase())) {
                    return true;
                }
            }
        }
        return false;
    }

    _changeStatusIcon(newMessage) {
        // Change Status Icon in Panel
        if (newMessage && !this._iconChanged) {
            const color = this._settings.get_string("color-rgba");
            this._iconBox.set_style("color: " + color + ";");
            this._iconChanged = true;
            this._indicator.animate();
        } else if (!newMessage && this._iconChanged) {
            this._iconBox.set_style(this._originalStyle);
            this._iconChanged = false;
            this._indicator.animate();
        }
    }

    _unseenMessageCheck(source) {
        if (source.countVisible === undefined) {
            return source.unseenCount > 0;
        } else {
            return source.countVisible > 0;
        }
    }

    _onNotificationSourcesChanged() {
        try {
            this._updateMessageStatus();
        } catch (err) {
            /* If the extension is broken I don't want to break everything.
             * We just catch the extension, print it and go on */
            this.getLogger().error(err);
        }
    }

    _trackNotificationSource(source) {
        if (this._notificationSources.has(source)) {
            return;
        }

        source.connectObject("notify::count", this._onNotificationSourcesChanged.bind(this), this);
        this._notificationSources.add(source);
    }

    _untrackNotificationSource(source) {
        if (!this._notificationSources.has(source)) {
            return;
        }

        source.disconnectObject(this);
        this._notificationSources.delete(source);
    }

    _onNotificationSourceAdded(tray, source) {
        this._trackNotificationSource(source);
        this._onNotificationSourcesChanged();
    }

    _onNotificationSourceRemoved(tray, source) {
        this._untrackNotificationSource(source);
        this._onNotificationSourcesChanged();
    }

    _onParamChanged() {
        this.disable();
        this.enable();
    }

    enable() {
        this._settings = this.getSettings();
        this._indicator = new MessageMenu(this);

        // add Signals to array
        this._settingSignals = [];
        const settingsToMonitor = [
            { key: "compatible-chats", callback: "_onParamChanged" },
            { key: "compatible-mblogs", callback: "_onParamChanged" },
            { key: "compatible-emails", callback: "_onParamChanged" },
        ];
        for (const setting of settingsToMonitor) {
            this._settingSignals.push(
                this._settings.connect(`changed::${setting.key}`, this[setting.callback].bind(this))
            );
        }

        const statusArea = Main.panel.statusArea;

        Main.panel.addToStatusArea("messageMenu", this._indicator, 1);

        this._iconBox = statusArea.messageMenu;
        this._iconChanged = false;
        this._originalStyle = this._iconBox.get_style();
        this._notificationSources = new Set();
        Main.messageTray.connectObject(
            "source-added",
            this._onNotificationSourceAdded.bind(this),
            "source-removed",
            this._onNotificationSourceRemoved.bind(this),
            this
        );
        for (const source of Main.messageTray.getSources()) {
            this._trackNotificationSource(source);
        }
        this._onNotificationSourcesChanged();
    }

    disable() {
        // remove setting Signals
        for (const signal of this._settingSignals) {
            this._settings.disconnect(signal);
        }
        this._settingSignals = null;
        Main.messageTray.disconnectObject(this);
        for (const source of this._notificationSources) {
            source.disconnectObject(this);
        }
        this._notificationSources = null;
        this._indicator.destroy();
        this._indicator = null;
        this._settings = null;
        this._iconBox = null;
        this._iconChanged = null;
        this._originalStyle = null;
    }
}
