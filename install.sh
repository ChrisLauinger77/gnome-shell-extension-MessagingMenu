#!/bin/bash

# glib-compile-schemas messagingmenu\@lauinger-clan.de/schemas/

cd messagingmenu\@lauinger-clan.de
gnome-extensions pack --podir=../po/ --out-dir=../ --extra-source=\ui --extra-source=\icons --extra-source=../LICENSE --force
cd ..

case "$1" in
  zip|pack)
    echo "Extension zip created ..."
    ;;
  install)
    gnome-extensions install messagingmenu\@lauinger-clan.de.shell-extension.zip --force
    gnome-extensions enable messagingmenu\@lauinger-clan.de
    ;;
  upload)
    gnome-extensions upload messagingmenu\@lauinger-clan.de.shell-extension.zip
    ;;
  *)
  echo "Usage: $0 {zip|pack|install|upload}"
    exit 1
    ;;
esac