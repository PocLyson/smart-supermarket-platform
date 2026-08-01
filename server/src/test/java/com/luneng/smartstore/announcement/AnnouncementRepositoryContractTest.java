package com.luneng.smartstore.announcement;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

class AnnouncementRepositoryContractTest {
    @Test
    void publishedQueriesDeclareDescendingIdAsTheTieBreaker() {
        assertThat(AnnouncementRepository.class.getMethods())
            .extracting(Method::getName)
            .contains(
                "findAllByStatusOrderByPublishedAtDescIdDesc",
                "findFirstByStatusOrderByPublishedAtDescIdDesc"
            );
    }
}
