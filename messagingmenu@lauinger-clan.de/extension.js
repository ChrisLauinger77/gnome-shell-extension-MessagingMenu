"use strict";

import Shell from "gi://Shell";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Util from "resource:///org/gnome/shell/misc/util.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as animationUtils from "resource:///org/gnome/shell/misc/animationUtils.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

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

            this.new_msg_string = _("Compose New Message");
            this.contacts_string = _("Contacts");

            this._availableEmails = [];
            this._availableChats = [];
            this._availableMBlogs = [];
            this._availableNotifiers = [];

            this._thunderbird = null;
            this._icedove = null;
            this._kmail = null;
            this._claws = null;
            this._evolution = null;
            this._geary = null;
            this._letter = null;
            this._stamp = null;

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
            const compose = (activate) => ({
                label: this.new_msg_string,
                iconName: "mail-message-new-symbolic",
                activate,
            });
            const contacts = (activate) => ({
                label: this.contacts_string,
                iconName: "contact-new-symbolic",
                activate,
            });
            const menus = [
                {
                    app: this._evolution,
                    actions: [compose(() => this._evolutionCompose()), contacts(() => this._evolutionContacts())],
                },
                {
                    app: this._thunderbird,
                    actions: [compose(() => this._thunderbirdCompose()), contacts(() => this._thunderbirdContacts())],
                },
                {
                    app: this._icedove,
                    actions: [compose(() => this._icedoveCompose()), contacts(() => this._icedoveContacts())],
                },
                {
                    app: this._kmail,
                    actions: [compose(() => this._kmailCompose())],
                },
                {
                    app: this._claws,
                    actions: [compose(() => this._clawsCompose())],
                },
                {
                    app: this._geary,
                    actions: [compose(() => this._gearyCompose())],
                },
                {
                    app: this._letter,
                    actions: [compose(() => this._letterCompose())],
                },
                {
                    app: this._stamp,
                    actions: [compose(() => this._stampCompose())],
                },
            ];

            for (const { app, actions } of menus) {
                this._addApplicationMenu(app, actions);
            }
        }

        _buildMenu(extension) {
            for (const e_app of this._availableEmails) {
                const newLauncher = this.createMessageMenuItem(e_app);
                this.menu.addMenuItem(newLauncher);
            }
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
            for (const app_name of this._compatible_Emails) {
                const app = appsys.lookup_app(app_name + ".desktop");
                if (app !== null) {
                    // filter Apps with special Menus
                    if (app_name.toLowerCase().includes("thunderbird")) {
                        this._thunderbird = app;
                    } else if (app_name.toLowerCase().includes("icedove")) {
                        this._icedove = app;
                    } else if (app_name.toLowerCase().includes("kmail")) {
                        this._kmail = app;
                    } else if (app_name.toLowerCase().includes("claws")) {
                        this._claws = app;
                    } else if (app_name.toLowerCase().includes("evolution")) {
                        this._evolution = app;
                    } else if (app_name.toLowerCase().includes("geary")) {
                        this._geary = app;
                    } else if (app_name.toLowerCase().includes("letter")) {
                        this._letter = app;
                    } else if (app_name.toLowerCase().includes("stamp")) {
                        this._stamp = app;
                    } else {
                        this._availableEmails.push(app);
                    }
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

        _thunderbirdCompose() {
            this._launchActionOrCommand(this._thunderbird, "ComposeMessage", "thunderbird -compose");
        }

        _thunderbirdContacts() {
            this._launchActionOrCommand(this._thunderbird, "OpenAddressBook", "thunderbird -addressbook");
        }

        _icedoveCompose() {
            this._launchActionOrCommand(this._icedove, "ComposeMessage", "icedove -compose");
        }

        _icedoveContacts() {
            this._launchActionOrCommand(this._icedove, "OpenAddressBook", "icedove -addressbook");
        }

        _kmailCompose() {
            this._launchActionOrCommand(this._kmail, "Composer", "kmail --composer");
        }

        _clawsCompose() {
            this._launchActionOrCommand(this._claws, "ComposeMail", "claws-mail --compose");
        }

        _evolutionCompose() {
            this._launchActionOrCommand(this._evolution, "compose", "evolution mailto:");
        }

        _evolutionContacts() {
            this._launchActionOrCommand(this._evolution, "contacts", "evolution -c contacts");
        }

        _gearyCompose() {
            this._launchActionOrCommand(this._geary, "compose", "geary mailto:user@example.com");
        }

        _letterCompose() {
            const command = "flatpak run io.github.stalvatero.Letter --new-message";
            this._launchActionOrCommand(this._letter, "new-message", command);
        }

        _stampCompose() {
            this._launchActionOrCommand(this._stamp, "Compose", "stamp mailto:");
        }

        _launchActionOrCommand(app, action, command) {
            if (app === null) {
                return;
            }

            const appInfo = app.get_app_info();
            const actions = appInfo === null ? [] : appInfo.list_actions();

            if (actions.includes(action)) {
                app.launch_action(action, 0, -1);
            } else if (command) {
                Util.trySpawnCommandLine(command);
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
