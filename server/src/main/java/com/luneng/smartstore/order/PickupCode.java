package com.luneng.smartstore.order;

final class PickupCode {
    private PickupCode() {
    }

    static String fromOrderNo(String orderNo) {
        String digits = orderNo.replaceAll("\\D", "");
        String suffix = digits.length() > 6
            ? digits.substring(digits.length() - 6)
            : digits;
        return "0".repeat(Math.max(0, 6 - suffix.length())) + suffix;
    }
}
