package graph

// deref returns the string or an empty value when nil.
func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
