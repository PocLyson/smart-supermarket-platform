package com.luneng.smartstore.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

interface OperationLogRepository
    extends JpaRepository<OperationLog, Long>, JpaSpecificationExecutor<OperationLog> {
}
