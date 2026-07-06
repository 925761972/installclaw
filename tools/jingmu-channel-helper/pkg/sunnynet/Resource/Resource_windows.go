//go:build windows

package Resource

import _ "embed"

// Windows-only driver resources. A reproducible Windows source build requires
// the upstream nfapi DLLs in addition to the committed SYS files.

//go:embed nfapi/sys/tdi/amd64/netfilter2.sys
var TdiAmd64Netfilter2 []byte

//go:embed nfapi/sys/tdi/i386/netfilter2.sys
var TdiI386Netfilter2 []byte

//go:embed nfapi/sys/wfp/amd64/netfilter2.sys
var WfpAmd64Netfilter2 []byte

//go:embed nfapi/sys/wfp/i386/netfilter2.sys
var WfpI386Netfilter2 []byte

//go:embed nfapi/dll/win32/nfapi.dll
var NfapiWin32Nfapi []byte

//go:embed nfapi/dll/x64/nfapi.dll
var NfapiX64Nfapi []byte
