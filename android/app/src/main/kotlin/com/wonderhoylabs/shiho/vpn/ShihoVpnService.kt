package com.wonderhoylabs.shiho.vpn

import com.wonderhoylabs.shiho.BuildConfig
import com.wonderhoylabs.shiho.R
import com.wonderhoylabs.shiho.ui.MainActivity
import com.wonderhoylabs.shira.vpn.LinkTexts
import com.wonderhoylabs.shira.vpn.LinkVpnService

/**
 * Shiho's VPN: Shira's LinkVpnService with Shiho's socket name, words and icon. The page on the computer opens each
 * connection itself, so the phone's traffic leaves from the computer.
 */
internal class ShihoVpnService : LinkVpnService() {
	override val socketName = SOCKET_NAME
	override val appVersion: String = BuildConfig.VERSION_NAME
	override val notificationIcon = R.drawable.ic_notification
	override val appActivity = MainActivity::class.java

	override fun texts() = LinkTexts(
		appName = getString(R.string.app_name),
		notificationChannel = getString(R.string.notification_channel),
		waiting = getString(R.string.notification_waiting),
		connected = { getString(R.string.notification_connected) },
		deactivate = getString(R.string.deactivate),
		socketTaken = getString(R.string.error_socket_taken),
		revoked = getString(R.string.error_revoked),
		notPrepared = getString(R.string.error_not_prepared),
	)

	companion object {
		/** The page opens it as `localabstract:shiho`. */
		const val SOCKET_NAME = "shiho"
	}
}
