#!/bin/sh
curl -L https://firmware.darmstadt.freifunk.net/images/stable/factory > stable/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/images/stable/sysupgrade > stable/sysupgrade/index.html
curl -L https://firmware.darmstadt.freifunk.net/images/beta/factory > beta/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/images/beta/sysupgrade > beta/sysupgrade/index.html
curl -L https://firmware.darmstadt.freifunk.net/images/experimental/factory > experimental/factory/index.html
curl -L https://firmware.darmstadt.freifunk.net/images/experimental/sysupgrade > experimental/sysupgrade/index.html
