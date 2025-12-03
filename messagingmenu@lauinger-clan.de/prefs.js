"use strict";

import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GObject from "gi://GObject";
import {
    ExtensionPreferences,
    gettext as _,
    ngettext,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

const AppChooser = GObject.registerClass(
    class AppChooser extends Adw.Window {
        constructor(params = {}) {
            super(params);
            const adwtoolbarview = new Adw.ToolbarView();
            const adwheaderbar = new Adw.HeaderBar();
            adwtoolbarview.add_top_bar(adwheaderbar);
            this.set_content(adwtoolbarview);

            const searchEntry = new Gtk.SearchEntry({
                placeholder_text: _("Search..."),
                hexpand: true,
            });
            adwheaderbar.set_title_widget(searchEntry);

            const scrolledwindow = new Gtk.ScrolledWindow();
            adwtoolbarview.set_content(scrolledwindow);
            this.listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.SINGLE,
            });
            scrolledwindow.set_child(this.listBox);
            this.selectBtn = new Gtk.Button({
                label: _("Select"),
                css_classes: ["suggested-action"],
            });
            this.cancelBtn = new Gtk.Button({ label: _("Cancel") });
            adwheaderbar.pack_start(this.cancelBtn);
            adwheaderbar.pack_end(this.selectBtn);
            const apps = Gio.AppInfo.get_all()
                .filter((app) => app.should_show())
                .sort((a, b) => {
                    const nameA = a.get_display_name().toLowerCase();
                    const nameB = b.get_display_name().toLowerCase();
                    return nameA.localeCompare(nameB);
                });
            for (const app of apps) {
                if (app.should_show() === false) continue;
                const row = new Adw.ActionRow();
                row.title = app.get_display_name();
                row.subtitle = app.get_id();
                row._searchableText = app.get_display_name().toLowerCase() + " " + app.get_name().toLowerCase();
                row.subtitleLines = 1;
                const icon = new Gtk.Image({ gicon: app.get_icon() });
                row.add_prefix(icon);
                this.listBox.append(row);
            }
            const filterFunc = (row) => {
                const filterText = searchEntry.get_text().toLowerCase();
                if (!filterText) return true;
                return row._searchableText.includes(filterText);
            };
            this.listBox.set_filter_func(filterFunc);
            searchEntry.connect("search-changed", () => {
                this.listBox.invalidate_filter();
            });
            this.cancelBtn.connect("clicked", () => {
                this.close();
            });
        }

        showChooser() {
            return new Promise((resolve) => {
                const signalId = this.selectBtn.connect("clicked", () => {
                    this.close();
                    this.selectBtn.disconnect(signalId);
                    const row = this.listBox.get_selected_row();
                    resolve(row);
                });
                this.present();
            });
        }
    }
);

export default class AdwPrefs extends ExtensionPreferences {
    _addMenuChangeDesc(cmb_add, group_add) {
        if (cmb_add.get_selected() < 3) {
            group_add.set_description(_("Name of .desktop files without .desktop ending"));
        } else {
            group_add.set_description(_("Notifier title"));
        }
    }

    _addMenu(cmb_add, entry_add, builder) {
        if (entry_add.get_text() === "") {
            this.getLogger().log("_addMenu did not find entry_add text");
            return;
        }
        let strSettings = "";
        let strGroup = "";
        switch (cmb_add.get_selected()) {
            case 0:
                strSettings = "compatible-emails";
                strGroup = "messagingmenu_group_email";
                break;
            case 1:
                strSettings = "compatible-chats";
                strGroup = "messagingmenu_group_chat";
                break;
            case 2:
                strSettings = "compatible-mblogs";
                strGroup = "messagingmenu_group_mblog";
                break;
            case 3:
                strSettings = "compatible-hidden-email-notifiers";
                strGroup = "messagingmenu_group_emailnotifiers";
                break;
            case 4:
                strSettings = "compatible-hidden-mblog-notifiers";
                strGroup = "messagingmenu_group_mblognotifiers";
                break;
            default:
                this.getLogger().log("_addMenu did not find get_active_id");
        }
        const valuesettings = this.getSettings().get_string(strSettings);
        if (!valuesettings.toLowerCase().includes(entry_add.text.toLowerCase())) {
            this.getSettings().set_string(strSettings, valuesettings + ";" + entry_add.text);
            const group = builder.get_object(strGroup);
            const adwrow = new Adw.ActionRow({ title: entry_add.text });
            group.add(adwrow);
            entry_add.text = "";
        }
    }

    _findWidgetByType(parent, type) {
        for (const child of parent) {
            if (child instanceof type) return child;

            const match = this._findWidgetByType(child, type);
            if (match) return match;
        }
        return null;
    }

    _addResetButton(window, settings) {
        const button = new Gtk.Button({
            label: _("Reset Settings"),
            icon_name: "edit-clear",
            css_classes: ["destructive-action"],
            vexpand: true,
            valign: Gtk.Align.END,
        });
        button.set_tooltip_text(_("Reset all settings to default values"));
        button.connect("clicked", () => {
            this._resetSettings(settings, "all");
        });

        const header = this._findWidgetByType(window.get_content(), Adw.HeaderBar);
        if (header) {
            header.pack_start(button);
        }
    }

    _onColorChanged(color_setting_button) {
        this.getSettings().set_string("color-rgba", color_setting_button.get_rgba().to_string());
    }

    _overtakeScanRow(builder, adwrow) {
        const group_add = builder.get_object("messagingmenu_group_add");
        const cmb_add = builder.get_object("messagingmenu_cmb_add");
        const entry_add = builder.get_object("messagingmenu_row_add2");
        if (adwrow) {
            cmb_add.set_selected(adwrow.get_selected());
            entry_add.set_text(adwrow.title);
        }
        group_add.remove(adwrow);
        this._addMenu(cmb_add, entry_add, builder);
    }

    _addScanRow(builder, app, cmbid) {
        const group_add = builder.get_object("messagingmenu_group_add");
        const adwrow = new Adw.ComboRow({
            title: app.get_id().slice(0, -8), // Remove .desktop suffix
            subtitle: app.get_description(),
        });
        adwrow.set_tooltip_text(_("Found by scan"));
        const stringlist = new Gtk.StringList();
        stringlist.append(_("Email"));
        stringlist.append(_("Chat"));
        stringlist.append(_("Micro blogging"));
        stringlist.append(_("Email notifier"));
        stringlist.append(_("Micro blogging notifier"));
        adwrow.set_model(stringlist);
        adwrow.add_prefix(new Gtk.Image({ gicon: app.get_icon() }));
        adwrow.set_selected(cmbid);
        group_add.add(adwrow);
        const button_add = new Gtk.Button({ label: _("Add") });
        button_add.set_css_classes(["suggested-action"]);
        button_add.valign = Gtk.Align.CENTER;
        button_add.connect("clicked", this._overtakeScanRow.bind(this, builder, adwrow));
        adwrow.add_suffix(button_add);
    }

    _scanApps(builder, settings) {
        const button_scan = builder.get_object("messagingmenu_row_buttonscan");
        button_scan.set_sensitive(false);
        const apps = Gio.AppInfo.get_all();
        const adwrow = builder.get_object("messagingmenu_row_scanresult");
        adwrow.visible = true;
        const compatibleemails = settings.get_string("compatible-emails");
        const compatiblechats = settings.get_string("compatible-chats");
        const compatiblehiddenemailnotifiers = settings.get_string("compatible-hidden-email-notifiers");
        let count = 0;
        for (const app of apps) {
            const deskappinfo = Gio.DesktopAppInfo.new(app.get_id());
            const categories = deskappinfo.get_categories();
            const settingsapp = app.get_id().slice(0, -8); // Remove .desktop suffix
            if (categories !== null && categories.includes("Email")) {
                if (!compatibleemails.includes(settingsapp) && !compatiblehiddenemailnotifiers.includes(settingsapp)) {
                    this._addScanRow(builder, app, 0);
                    this.getLogger().log("Email app found:", app.get_id());
                    count += 1;
                }
            }
            if (categories !== null && categories.includes("Chat")) {
                if (!compatiblechats.includes(settingsapp)) {
                    this._addScanRow(builder, app, 1);
                    this.getLogger().log("Chat app found:", app.get_id());
                    count += 1;
                }
            }
        }
        adwrow.set_title(_("Scan finished"));
        adwrow.set_subtitle(ngettext("Scan found %d app", "Scan found %d apps", count).format(count));
    }

    _resetSettings(settings, strKey) {
        if (strKey === "all") {
            // List all keys you want to reset
            const keys = [
                "compatible-chats",
                "compatible-mblogs",
                "compatible-emails",
                "compatible-hidden-email-notifiers",
                "compatible-hidden-mblog-notifiers",
                "icon-size",
                "notify-email",
                "notify-chat",
                "notify-mblogging",
                "color-rgba",
            ];
            for (const key of keys) {
                if (settings.is_writable(key)) {
                    settings.reset(key);
                }
            }
        } else if (settings.is_writable(strKey)) {
            settings.reset(strKey);
        }
    }

    _page1(builder, settings, myAppChooser) {
        const email_setting_switch = builder.get_object("messagingmenu_row1");
        settings.bind("notify-email", email_setting_switch, "active", Gio.SettingsBindFlags.DEFAULT);
        const chat_setting_switch = builder.get_object("messagingmenu_row2");
        settings.bind("notify-chat", chat_setting_switch, "active", Gio.SettingsBindFlags.DEFAULT);
        const mblogging_setting_switch = builder.get_object("messagingmenu_row3");
        settings.bind("notify-mblogging", mblogging_setting_switch, "active", Gio.SettingsBindFlags.DEFAULT);
        const color_setting_button = builder.get_object("color_setting_button");
        const mycolor = new Gdk.RGBA();
        mycolor.parse(this.getSettings().get_string("color-rgba"));
        color_setting_button.set_rgba(mycolor);
        color_setting_button.connect("color-set", this._onColorChanged.bind(this, color_setting_button));
        const rowwiggle = builder.get_object("messagingmenu_rowwiggle");
        settings.bind("wiggle-indicator", rowwiggle, "active", Gio.SettingsBindFlags.DEFAULT);
        const row5 = builder.get_object("messagingmenu_row5");
        settings.bind("icon-size", row5, "value", Gio.SettingsBindFlags.DEFAULT);

        const group_add = builder.get_object("messagingmenu_group_add");
        const cmb_add = builder.get_object("messagingmenu_cmb_add");
        cmb_add.set_selected(0);
        cmb_add.connect("notify", this._addMenuChangeDesc.bind(this, cmb_add, group_add));
        const button_add = builder.get_object("messagingmenu_row_buttonadd");
        const entry_add = builder.get_object("messagingmenu_row_add2");
        button_add.connect("activated", this._addMenu.bind(this, cmb_add, entry_add, builder));
        const buttonfilechooser = builder.get_object("messagingmenu_row_buttonselectapp");
        buttonfilechooser.connect("activated", async () => {
            const errorLog = (...args) => {
                this.getLogger().error("Error:", ...args);
            };
            const handleError = (error) => {
                errorLog(error);
                return null;
            };
            const appRow = await myAppChooser.showChooser().catch(handleError);
            if (appRow !== null) {
                entry_add.set_text(appRow.subtitle.replace(".desktop", ""));
            }
        });
        const button_scan = builder.get_object("messagingmenu_row_buttonscan");
        button_scan.connect("activated", this._scanApps.bind(this, builder, settings));
    }

    _addAppIcon(adwrow, appname) {
        const apps = Gio.AppInfo.get_all();

        for (const app of apps) {
            if (appname.includes(app.get_id().slice(0, -8))) {
                adwrow.subtitle = app.get_description();
                const icon = new Gtk.Image({ gicon: app.get_icon() });
                adwrow.add_prefix(icon);
                return;
            }
        }
    }

    _fillgroup(group, applist) {
        for (const app of applist) {
            const adwrow = new Adw.ActionRow({ title: app });
            group.add(adwrow);
            this._addAppIcon(adwrow, app);
        }
    }

    _pages(builder, settings) {
        let apps = settings.get_string("compatible-emails").split(";").sort(Intl.Collator().compare);
        let group = builder.get_object("messagingmenu_group_email");
        this._fillgroup(group, apps);

        apps = settings.get_string("compatible-chats").split(";").sort(Intl.Collator().compare);
        group = builder.get_object("messagingmenu_group_chat");
        this._fillgroup(group, apps);

        apps = settings.get_string("compatible-mblogs").split(";").sort(Intl.Collator().compare);
        group = builder.get_object("messagingmenu_group_mblog");
        this._fillgroup(group, apps);

        apps = settings.get_string("compatible-hidden-email-notifiers").split(";").sort(Intl.Collator().compare);
        group = builder.get_object("messagingmenu_group_emailnotifiers");
        this._fillgroup(group, apps);

        apps = settings.get_string("compatible-hidden-mblog-notifiers").split(";").sort(Intl.Collator().compare);
        group = builder.get_object("messagingmenu_group_mblognotifiers");
        this._fillgroup(group, apps);
    }

    fillPreferencesWindow(window) {
        window.search_enabled = true;
        window.set_default_size(675, 775);
        const builder = Gtk.Builder.new();
        builder.add_from_file(this.path + "/ui/prefs.ui");
        const page1 = builder.get_object("messagingmenu_page_settings");
        window.add(page1);
        const myAppChooser = new AppChooser({
            title: _("Select app"),
            modal: true,
            transient_for: page1.get_root(),
            hide_on_close: true,
            width_request: 300,
            height_request: 600,
            resizable: false,
        });
        const page2 = builder.get_object("messagingmenu_page_email");
        window.add(page2);
        const page3 = builder.get_object("messagingmenu_page_chat");
        window.add(page3);
        const page4 = builder.get_object("messagingmenu_page_mblog");
        window.add(page4);
        const page5 = builder.get_object("messagingmenu_page_notifiers");
        window.add(page5);
        this._addResetButton(window, this.getSettings());
        this._page1(builder, this.getSettings(), myAppChooser);
        this._pages(builder, this.getSettings());
    }
}
