package com.wonderhoylabs.shiho.ui

import com.wonderhoylabs.shiho.vpn.ShihoVpnService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BrandTest {
	@Test
	fun brandIsFilledIn() {
		assertEquals("Shiho", Brand.NAME)
		assertTrue(Brand.CHARACTER.isNotBlank())
		assertTrue(Brand.REPOSITORY.startsWith("https://github.com/wonderhoy-labs/"))
	}

	@Test
	fun socketIsShihosOwn() {
		// The page opens localabstract:shiho, which @wonderhoy-labs/shiho's SHIHO_APP names too.
		assertEquals("shiho", ShihoVpnService.SOCKET_NAME)
	}

	@Test
	fun bytesReadAsPeopleExpect() {
		assertEquals("512 B", formatBytes(512))
		assertEquals("1.5 KB", formatBytes(1536))
		assertEquals("2.0 MB", formatBytes(2L * 1024 * 1024))
	}
}
