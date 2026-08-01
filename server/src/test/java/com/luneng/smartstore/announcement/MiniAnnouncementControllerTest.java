package com.luneng.smartstore.announcement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.luneng.smartstore.common.api.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class MiniAnnouncementControllerTest {
    private final AnnouncementService service = mock(AnnouncementService.class);
    private final HttpServletRequest request = mock(HttpServletRequest.class);
    private final MiniAnnouncementController controller = new MiniAnnouncementController(service);

    @Test
    void everyPublicEndpointExposesOnlyTheMiniAnnouncementContract() {
        AnnouncementView internal = new AnnouncementView(
            7L,
            "Store hours",
            "Closing at 20:00",
            AnnouncementStatus.PUBLISHED,
            Instant.parse("2026-08-01T12:00:00Z"),
            11L,
            12L,
            Instant.parse("2026-08-01T10:00:00Z"),
            Instant.parse("2026-08-01T12:00:00Z")
        );
        when(service.latestPublished()).thenReturn(Optional.of(internal));
        when(service.listPublished(0, 20)).thenReturn(
            new PageImpl<>(java.util.List.of(internal), PageRequest.of(0, 20), 1)
        );
        when(service.detailPublished(7L)).thenReturn(internal);

        Object latest = controller.latest(request).data();
        PageResult<?> list = controller.list(0, 20, request).data();
        Object detail = controller.detail(7L, request).data();

        assertPublicShape(latest);
        assertPublicShape(list.items().get(0));
        assertPublicShape(detail);
    }

    private void assertPublicShape(Object value) {
        assertThat(value.getClass().getRecordComponents())
            .extracting(RecordComponent::getName)
            .containsExactly("id", "title", "content", "publishedAt");
    }
}
