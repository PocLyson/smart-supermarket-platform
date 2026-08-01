package com.luneng.smartstore.announcement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnnouncementWriteRequest(
    @NotBlank @Size(max = 60) String title,
    @NotBlank @Size(max = 2000) String content
) {
}
