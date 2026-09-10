plugins {
    java
    id("org.cyclonedx.bom") version "3.4.1"
    id("org.springframework.boot") version "4.1.1"
}
group = "com.blariyo"
version = "0.1.0"
java { toolchain { languageVersion = JavaLanguageVersion.of(25) } }
repositories { mavenCentral() }
dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:4.1.1"))
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-batch")
    implementation("org.springframework.boot:spring-boot-starter-quartz")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.jsoup:jsoup:1.23.2")
    implementation("net.dv8tion:JDA:6.4.2")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
dependencyLocking { lockAllConfigurations() }
tasks.test { useJUnitPlatform() }
tasks.register<JavaExec>("migrate") {
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "com.blariyo.collector.ops.MigrationMain"
}
tasks.register("dependencyInventory") {
    val output = layout.buildDirectory.file("reports/dependency-inventory.tsv")
    outputs.file(output)
    doLast {
        val file = output.get().asFile
        file.parentFile.mkdirs()
        file.writeText("group\tname\tversion\n" + configurations.runtimeClasspath.get().resolvedConfiguration.resolvedArtifacts
            .sortedBy { it.moduleVersion.id.toString() }
            .joinToString("\n") { "${it.moduleVersion.id.group}\t${it.name}\t${it.moduleVersion.id.version}" } + "\n")
    }
}

springBoot { mainClass = "com.blariyo.collector.CollectorApplication" }
tasks.register("fixtureClasspath") {
    dependsOn(tasks.testClasses)
    doLast { layout.buildDirectory.file("fixture-classpath.txt").get().asFile.writeText(sourceSets.test.get().runtimeClasspath.asPath) }
}
