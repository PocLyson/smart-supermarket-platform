package com.luneng.smartstore.store;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class StoreContactApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void anonymousMiniContactReturnsTheConfiguredCustomerServiceDetails() throws Exception {
        mockMvc.perform(get("/api/mini/store/contact"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.phone").value("18653045492"))
            .andExpect(jsonPath("$.data.customerServiceEnabled").value(true));
    }
}
