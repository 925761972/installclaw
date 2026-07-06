//go:build !windows

package Resource

// These symbols are referenced by shared SunnyNet code but never used outside
// Windows. Keeping empty values avoids shipping Windows kernel resources in the
// macOS application bundle.
var (
	TdiAmd64Netfilter2 []byte
	TdiI386Netfilter2  []byte
	WfpAmd64Netfilter2 []byte
	WfpI386Netfilter2  []byte
	NfapiWin32Nfapi    []byte
	NfapiX64Nfapi      []byte
)
