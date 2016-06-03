#!/bin/sh
curl -L https://firmware.darmstadt.freifunk.net/stable/factory > stable/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/stable/sysupgrade > stable/sysupgrade/index.html
curl -L https://firmware.darmstadt.freifunk.net/beta/factory > beta/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/beta/sysupgrade > beta/sysupgrade/index.html
curl -L https://firmware.darmstadt.freifunk.net/experimental/factory > experimental/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/experimental/sysupgrade > experimental/sysupgrade/index.html
