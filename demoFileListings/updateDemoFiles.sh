#!/bin/sh
curl -L https://firmware.darmstadt.freifunk.net/archive/stable/factory > stable/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/archive/stable/sysupgrade > stable/sysupgrade/index.html
curl -L https://firmware.darmstadt.freifunk.net/archive/beta/factory > beta/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/archive/beta/sysupgrade > beta/sysupgrade/index.html
curl -L https://firmware.darmstadt.freifunk.net/archive/experimental/factory > experimental/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/archive/experimental/sysupgrade > experimental/sysupgrade/index.html
